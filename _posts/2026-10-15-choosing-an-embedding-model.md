---
title: "Choosing an embedding model for short, messy, multilingual text"
date: 2026-10-15
categories: [Engineering, Research]
tags: [embeddings, nlp, multilingual, hindi, semantic-cache, onnx, cpu, voice-ai, evaluation]
mood: curious
visibility: public
pinned: false
excerpt: "Five models, two engines and a brand-new release, all tested on my own text, on my own CPU. The model with the best score was not the one I picked, and the engine mattered more than I expected."
---

<style>
.post-content:has(.ec-stats) p{margin:0 0 1.15em}.post-content:has(.ec-stats) h2{margin-top:2.2em}.ec-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:28px 0 36px}
.ec-stat{padding:16px 16px 14px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:14px;background:linear-gradient(160deg,color-mix(in srgb,var(--accent,#1f6f54) 11%,transparent),color-mix(in srgb,currentColor 3%,transparent))}
.ec-stat b{display:block;font-size:30px;line-height:1.1;letter-spacing:-.02em;color:color-mix(in srgb,var(--accent,#1f6f54) 62%,currentColor);font-variant-numeric:tabular-nums}
.ec-stat span{display:block;margin-top:6px;font-size:12.5px;line-height:1.35;opacity:.7}
.ec-story{margin:26px 0;padding:18px 20px 16px;border-radius:14px;border:1px solid color-mix(in srgb,var(--accent,#1f6f54) 35%,transparent);border-left:5px solid var(--accent,#1f6f54);background:color-mix(in srgb,var(--accent,#1f6f54) 8%,transparent)}
.ec-story .ec-tag{display:inline-block;margin-bottom:8px;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--accent,#1f6f54) 62%,currentColor);background:color-mix(in srgb,var(--accent,#1f6f54) 15%,transparent)}
.ec-story p{margin:0;font-size:.97em;line-height:1.7}
.ec-card{margin:26px 0;padding:20px 22px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:14px;background:color-mix(in srgb,currentColor 3.5%,transparent)}
.ec-card h4{margin:0 0 4px;font-size:14px;letter-spacing:.02em}
.ec-card .ec-sub{margin:0 0 16px;font-size:13px;opacity:.65}
.ec-row{display:grid;grid-template-columns:150px 1fr;gap:6px 14px;align-items:center;margin:11px 0}
.ec-label{font-size:13.5px;font-weight:600}
.ec-label small{display:block;font-weight:400;opacity:.6;font-size:11.5px}
.ec-track{position:relative;height:26px;border-radius:7px;background:color-mix(in srgb,currentColor 8%,transparent);overflow:hidden}
.ec-fill{height:100%;border-radius:7px;display:flex;align-items:center;justify-content:flex-end;padding-right:9px;box-sizing:border-box;font-size:12px;font-weight:700;color:var(--bg,#fff);background:linear-gradient(90deg,color-mix(in srgb,var(--accent,#1f6f54) 70%,transparent),var(--accent,#1f6f54));min-width:46px;font-variant-numeric:tabular-nums}
.ec-fill.ec-mute{background:linear-gradient(90deg,color-mix(in srgb,var(--fg,#444) 42%,var(--bg,#888)),color-mix(in srgb,var(--fg,#444) 58%,var(--bg,#888)))}
.ec-fill.ec-warn{background:linear-gradient(90deg,#d4561a,#f08a3c)}
.ec-chips{grid-column:2;display:flex;flex-wrap:wrap;gap:6px;margin-top:-2px}
.ec-chip{padding:1px 9px;border-radius:99px;font-size:11.5px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);opacity:.8;font-variant-numeric:tabular-nums}
.ec-chip.ec-pick{border-color:var(--accent,#1f6f54);color:color-mix(in srgb,var(--accent,#1f6f54) 62%,currentColor);opacity:1;font-weight:700}
.ec-vs{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:stretch;margin:26px 0}
.ec-vs>div{padding:18px;border-radius:14px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);text-align:center}
.ec-vs .ec-bad{border-color:color-mix(in srgb,#e0661f 50%,transparent);background:color-mix(in srgb,#e0661f 7%,transparent)}
.ec-vs .ec-good{border-color:color-mix(in srgb,var(--accent,#1f6f54) 55%,transparent);background:color-mix(in srgb,var(--accent,#1f6f54) 9%,transparent)}
.ec-vs b{display:block;font-size:40px;line-height:1;letter-spacing:-.03em}
.ec-vs .ec-bad b{color:#e0661f;text-decoration:line-through;text-decoration-thickness:3px}
.ec-vs .ec-good b{color:color-mix(in srgb,var(--accent,#1f6f54) 62%,currentColor)}
.ec-vs span{display:block;margin-top:8px;font-size:12.5px;opacity:.75;line-height:1.4}
.ec-vs i{align-self:center;font-style:normal;font-size:22px;opacity:.5}
.ec-scroll{overflow-x:auto;margin:22px 0;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:12px}
.ec-table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.5}
.ec-table th{padding:10px 14px;text-align:left;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;background:color-mix(in srgb,currentColor 7%,transparent);white-space:nowrap}
.ec-table td{padding:10px 14px;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent);vertical-align:top}
.ec-table td:first-child{font-weight:600}
.ec-table .ec-no{color:#e0661f;font-weight:700}
.ec-table .ec-yes{color:color-mix(in srgb,var(--accent,#1f6f54) 62%,currentColor);font-weight:700}
.ec-table .ec-n{font-variant-numeric:tabular-nums;white-space:nowrap}
.post-content .ec-list{counter-reset:ec;list-style:none;margin:20px 0;padding:0;display:grid;gap:10px}
.post-content .ec-list li{counter-increment:ec;position:relative;margin:0;padding:14px 16px 14px 58px;border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:12px;line-height:1.6}
.post-content .ec-list li:before{content:counter(ec);position:absolute;left:14px;top:12px;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-weight:800;font-size:14px;color:var(--bg,#fff);background:var(--accent,#1f6f54)}
.ec-take{margin:22px 0;padding:14px 18px;border-radius:12px;border:1px dashed color-mix(in srgb,var(--accent,#1f6f54) 55%,transparent);font-size:1.02em;line-height:1.65}
.ec-take b{color:color-mix(in srgb,var(--accent,#1f6f54) 62%,currentColor)}
.ec-note{font-size:12.5px;opacity:.6;margin:10px 0 0}
@media (max-width:620px){.ec-row{grid-template-columns:1fr}.ec-chips{grid-column:1}.ec-vs{grid-template-columns:1fr}.ec-vs i{transform:rotate(90deg)}.ec-stat b{font-size:26px}}
</style>

<div class="ec-stats">
<div class="ec-stat"><b>5</b><span>embedding models, each at its own safe threshold</span></div>
<div class="ec-stat"><b>11,027</b><span>labelled pairs from 25,808 generated sentences</span></div>
<div class="ec-stat"><b>3.3&times;</b><span>faster with the same model on a different engine</span></div>
<div class="ec-stat"><b>14 ms</b><span>to embed one short question, on CPU only</span></div>
</div>

Every number in this post comes from my own runs in September and October 2026. Where something was not measured, I say so.

## 1. What I was trying to find out

I wanted to know which embedding model fits my own kind of text. That text is short, written in English, Hindi and the mix of the two that people actually type, full of filler words ("um", "so", "please"), and spelled inconsistently. The task is simple to state: given a sentence I already have, is a new sentence asking **the same thing**?

Three constraints shaped everything:

- **It has to run on ordinary CPUs.** No GPU, and it runs on every input, so every millisecond and every megabyte is paid again and again.
- **A false match is worse than a missed one.** Two sentences about the same topic are not the same question.
- **It has to work across scripts.** The same Hindi sentence turns up in Devanagari, in Roman letters or in a mix.

So "which model scores highest on a benchmark" was never the question. The question was: which model lets me pick a distance below which a match is safe, still finds the repeats I care about, and runs on the hardware I have.

## 2. Where I started, and why I stopped trusting it

I began with a small multilingual MiniLM and a match distance of 0.25. That number had been chosen from a single pair of opposite requests ("cancel" against "upgrade").

It held up until I added one more opposite pair. "Put my order on hold" against "release my order from hold" came out at **0.114**, well inside the threshold. One calibration point is not evidence that a threshold is safe.

<div class="ec-story">
<span class="ec-tag">A small story</span>
<p>Around then I loosened the match distance to 0.25 while testing on a made-up question set for a property developer. A question about when the project launches was matched to a stored sentence about something else. Nothing crashed and nothing looked wrong in the logs; the system simply returned the wrong neighbour with confidence. I pulled the distance back to 0.2. It was the first time the number on the dial felt like a safety setting and not a tuning knob.</p>
</div>

## 3. Building a test that could say no

I generated 25,808 sentences across 8 domains and two languages (English and Hindi), with the filler words and politeness that people really type. From them I sampled 11,027 labelled pairs, in classes that a good model must treat differently:

<div class="ec-scroll"><table class="ec-table">
<thead><tr><th>Pair class</th><th>Should they match?</th></tr></thead>
<tbody>
<tr><td>Same template, different filler</td><td><span class="ec-yes">Yes</span>, and it should be easy</td></tr>
<tr><td>Same domain and intent, different wording</td><td><span class="ec-yes">Yes</span>, but the labels are generous, so read this as a floor</td></tr>
<tr><td>Same topic, but a different question ("What is your refund policy?" against "Where is my refund?")</td><td><span class="ec-no">Never</span></td></tr>
<tr><td>Opposite actions (cancel against upgrade)</td><td><span class="ec-no">Never</span></td></tr>
<tr><td>Different domains</td><td><span class="ec-no">Never</span></td></tr>
<tr><td>The same question in English and in Hindi</td><td>Informational only</td></tr>
</tbody></table></div>

Here is what my starting threshold of 0.25 would have done on that test:

<div class="ec-card">
<h4>MiniLM at distance 0.25</h4>
<p class="ec-sub">Share of each pair class that would be matched. Orange bars are wrong matches.</p>
<div class="ec-row"><div class="ec-label">Genuine rewordings<small>should match</small></div><div class="ec-track"><div class="ec-fill ec-mute" style="width:14.8%">14.8%</div></div></div>
<div class="ec-row"><div class="ec-label">Same topic, different question<small>must never match</small></div><div class="ec-track"><div class="ec-fill ec-warn" style="width:5.9%">5.9%</div></div></div>
<div class="ec-row"><div class="ec-label">Opposite actions<small>must never match</small></div><div class="ec-track"><div class="ec-fill ec-warn" style="width:29.6%">29.6%</div></div></div>
</div>

No threshold fixed both. To push the wrong matches to zero, the distance had to drop to 0.125, where genuine-paraphrase recall fell to **2.2%**.

<div class="ec-take"><b>What I took from that:</b> embeddings measure topical similarity, not "is this the same question". Nearness is a good detector for near-duplicates (the same question again, spelled or phrased slightly differently) and a poor one for intent.</div>

<div class="ec-story">
<span class="ec-tag">A small story</span>
<p>The text was creative with a made-up company's name. It turned up as <b>प्रतीक</b>, an ordinary Hindi word that means "symbol", then as "progresses प्रतीक", then as "Progressive setting". A product called "A Stage Called Tomorrow" came back as "स्टेज फॉर टुमारो". The right match was in the stored set all along; the new sentence just never looked like my spelling. In the end I wrote every stored sentence in the forms a messy source would produce, and added a small list of "this spelling means that name" rules that run before anything is embedded.</p>
</div>

## 4. Five models, each at its own safe threshold

Cosine distances are not comparable between models, because each spreads its space differently. So I read every model at the highest threshold that gave **zero wrong matches** on both of the "never" classes, and counted the repeat questions it still found (out of 2,500 easy pairs):

<div class="ec-card">
<h4>Repeat questions found at each model's safe threshold</h4>
<p class="ec-sub">Out of 2,500 easy pairs. Chips show the safe threshold, time per text and vector size.</p>
<div class="ec-row"><div class="ec-label">jina-v3</div><div class="ec-track"><div class="ec-fill" style="width:91.8%">2,295 &middot; 91.8%</div></div><div class="ec-chips"><span class="ec-chip">threshold 0.150</span><span class="ec-chip">30.6 ms</span><span class="ec-chip">1024 dims</span></div></div>
<div class="ec-row"><div class="ec-label">EmbeddingGemma 300M<small>what I chose</small></div><div class="ec-track"><div class="ec-fill" style="width:66.2%">1,654 &middot; 66.2%</div></div><div class="ec-chips"><span class="ec-chip ec-pick">threshold 0.100</span><span class="ec-chip ec-pick">4.8 ms</span><span class="ec-chip ec-pick">768 dims</span></div></div>
<div class="ec-row"><div class="ec-label">bekko</div><div class="ec-track"><div class="ec-fill ec-mute" style="width:63.4%">1,586 &middot; 63.4%</div></div><div class="ec-chips"><span class="ec-chip">threshold 0.150</span><span class="ec-chip">4.5 ms</span><span class="ec-chip">384 dims</span></div></div>
<div class="ec-row"><div class="ec-label">MiniLM<small>where I started</small></div><div class="ec-track"><div class="ec-fill ec-mute" style="width:60.5%">1,512 &middot; 60.5%</div></div><div class="ec-chips"><span class="ec-chip">threshold 0.075</span><span class="ec-chip">1.5 ms</span><span class="ec-chip">384 dims</span></div></div>
<div class="ec-row"><div class="ec-label">multilingual-e5-base</div><div class="ec-track"><div class="ec-fill ec-mute" style="width:35.8%">894 &middot; 35.8%</div></div><div class="ec-chips"><span class="ec-chip">threshold 0.025</span><span class="ec-chip">7.0 ms</span><span class="ec-chip">768 dims</span></div></div>
</div>

Four things stood out:

<ol class="ec-list">
<li><b>The best finder was not the right model for me.</b> jina-v3 found every pair the Gemma model found, and 783 more than MiniLM. But it takes about 20 times longer per text (about 29 ms extra on every input), occupies 2.2 GB against 241 MB, and whether that pays off depends on how much each correct match saves you.</li>
<li><b>A strong cross-language model can be the wrong tool.</b> jina-v3 matched 117 of 1,000 English and Hindi pairs of the same question; the others matched 0 to 3. If your system must keep languages apart, that is a risk, not a feature.</li>
<li><b>Models disagree about what a repeat is.</b> Only 26% of the wanted pairs were found by all five models, and 7.8% by none. The middle 66% is where the choice of model decides the result.</li>
<li><b>A tighter threshold costs less than it seems.</b> At a 0.5% error budget, jina-v3 and MiniLM both sat at 0.150 and the gap was 91.8% against 86.9%, not 31 points.</li>
</ol>

The test has limits I would state plainly: the sentences are template-generated, not real text; there are only 27 opposite-action pairs, so each "zero wrong" threshold is decided by one or two pairs; and the "same intent" labels are over-generous.

My conclusion at the time was that the model was not the main lever. Tighten the threshold, and add a cheap word check that blocks a match when the sentence says "my", "right now" or "status".

## 5. Same model, different engine

I settled on EmbeddingGemma 300M, cut to 256 numbers (it is trained so that its first 256 numbers still work). One property made that practical: my document search already used the same model at the same size, so one vector can serve two jobs and an input is embedded once.

Then I asked a different question: is the PyTorch engine I was running it on the right one for CPUs? I compared it with the same model exported to ONNX and run through fastembed, both limited to 4 CPUs.

<div class="ec-card">
<h4>Requests per second, one client, 4 CPUs</h4>
<p class="ec-sub">Same model, same vectors, different engine.</p>
<div class="ec-row"><div class="ec-label">ONNX + fastembed</div><div class="ec-track"><div class="ec-fill" style="width:100%">50.9 req/s</div></div></div>
<div class="ec-row"><div class="ec-label">PyTorch</div><div class="ec-track"><div class="ec-fill ec-mute" style="width:30.1%">15.3</div></div></div>
<p class="ec-note">With four clients the gap grows to 12 times, because PyTorch's four-thread pools fight over four CPUs.</p>
</div>

- **Same vectors, if you add the prompts.** EmbeddingGemma expects a short instruction before queries and before documents. Without it, fastembed's vectors had a cosine of 0.835 to PyTorch's and the top-3 rankings agreed only 62% of the time. With the instructions added by hand the cosine was **0.99999** and the rankings agreed 100%. Vectors I had already stored stayed valid.
- **Faster.** 50.9 requests per second against 15.3 with one client (3.3 times), and 12 times with four clients.
- **Threads decide more than you expect.** Both engines size their thread pool from the host's core count, not the container's CPU limit. On a 16-core host limited to 4 CPUs that over-subscribes the CPU.
- **Bake the model in.** A model downloaded at start took 10 to 86 seconds to the first embedding; baked into the image it took about 3 seconds, at the price of an image 1.8 GB larger.
- **Footprint.** The ONNX build of my search service is 3.65 GB against 5.25 GB, and holds about 0.9 GB of memory.

<div class="ec-story">
<span class="ec-tag">A small story</span>
<p>My first chart said ONNX was 12 times faster, and it looked wonderful. Then I noticed the PyTorch run was using 16 threads on a 4-CPU container, while ONNX had been pinned to 4. Fair comparison: 3.3 times with one client. Still a good result, but a quarter of the headline. I redid the chart with equal threads, and that second chart is the one in this post.</p>
</div>

<div class="ec-vs">
<div class="ec-bad"><b>12&times;</b><span>first chart<br>16 threads vs 4 threads</span></div>
<i>&rarr;</i>
<div class="ec-good"><b>3.3&times;</b><span>fair chart<br>equal threads, one client</span></div>
</div>

Measured end to end through my search service, a short question took a median of **14 ms** to embed, against 64 to 90 ms with PyTorch.

One surprise from changing the engine: the right match distances moved, so a threshold tuned on one engine was wrong on the other. On the new path a wrong match sat at 0.156, so I tightened to 0.14 for a while and later settled on 0.2 with a slider I can move.

## 6. The new release: EmbeddingGemma 2

On 6 Oct 2026 Google released EmbeddingGemma 2: an Apache 2.0, 740M multimodal model whose **text part is 270M** and can be loaded without the vision (170M) and audio (300M) parts. It has 8,192 tokens of context and the same prompts and 256-number cut.

I tried it the way I had tried everything else: on my own data, on my own CPU, text only. The ONNX export has a text file with empty slots for image, video and audio input, so I passed empty arrays and left the other encoders out. I tested full precision and a 4-bit file (174 MB), on 26 questions that should match stored ones, 20 that must not, and 15 document-search questions against 22 paragraphs.

<div class="ec-scroll"><table class="ec-table">
<thead><tr><th></th><th>EmbeddingGemma (what I use)</th><th>EmbeddingGemma 2, text only</th></tr></thead>
<tbody>
<tr><td>Right paragraph ranked first (15)</td><td class="ec-n">14</td><td class="ec-n">15</td></tr>
<tr><td>Matching decisions right at the best threshold (46)</td><td class="ec-n">40</td><td class="ec-n">42</td></tr>
<tr><td>Right-vs-wrong separation (AUC)</td><td class="ec-n">0.946</td><td class="ec-n">0.954</td></tr>
<tr><td>Best distance threshold</td><td class="ec-n">about 0.285</td><td class="ec-n">about 0.165</td></tr>
<tr><td>Different-question sentences wrongly matched at 0.2 (of 20)</td><td class="ec-n">1</td><td class="ec-n">5</td></tr>
<tr><td>One short question</td><td class="ec-n">16 ms</td><td class="ec-n">22 ms (4-bit: 26 ms)</td></tr>
<tr><td>Memory</td><td class="ec-n">0.86 GB</td><td class="ec-n">1.18 GB</td></tr>
</tbody></table></div>

<div class="ec-story">
<span class="ec-tag">A small story</span>
<p>I had the model running nine days after it came out. The ONNX file for the text part has empty slots for images, video and audio, so to run it text-only I fed it zero-row arrays for pictures and sound it was never going to see. It worked on the first run, which is the best kind of anticlimax.</p>
</div>

Quality was within noise at this sample size. Everything else pointed the same way: it needs its own thresholds, it is slower, it uses more memory, the 4-bit file saves disk and not time on this CPU, and switching means re-embedding everything I have stored, because the vectors are not interchangeable. **I am not switching on this evidence.** What would change that is a bigger set of real questions, a check of the ONNX output against Google's reference code, and long inputs, where the larger context window might matter.

## 7. What I would tell someone choosing a model

<ol class="ec-list">
<li><b>Test on pairs that should not match,</b> not just ones that should. The dangerous pairs are the ones about the same topic.</li>
<li><b>Compare models at their own safe threshold.</b> Distances are not comparable across models, and a threshold from one model is wrong for the next.</li>
<li><b>Do the cost arithmetic per input,</b> not per match. The model runs on every sentence, so milliseconds and memory are paid every time.</li>
<li><b>Language is a safety question.</b> A model that is good at matching across languages may be the wrong one if you need to keep languages apart.</li>
<li><b>The engine is a separate decision from the model.</b> The same vectors came out of ONNX at several times the speed, and the thread count mattered as much as either.</li>
<li><b>Add the prompts the model was trained with,</b> and check the engine reproduces the reference vectors before trusting a speed result.</li>
<li><b>Measure on the hardware you will run on,</b> with the same container limits and the same thread counts for every candidate.</li>
<li><b>A bigger model that scores slightly better is not automatically better for you.</b> My own test said a tighter threshold and a cheap word check did more than any model swap.</li>
</ol>

<div class="ec-story">
<span class="ec-tag">One more story, about quiet failures</span>
<p>When I first pointed my document search at the new setup, it returned nothing and raised no error. The index held 256-number vectors and the search was asking for the 1536-number kind. A missing setting sent the question down the wrong path, and the only symptom was a search that suddenly found nothing. The lesson: check that the vector size and the model match on both sides, and log which path each search takes.</p>
</div>

## 8. What I did not measure

- Real text at scale for the model comparison.
- Memory and CPU under load, and under a CPU limit below the core count.
- EmbeddingGemma 2 against Google's reference code, and on long inputs.
