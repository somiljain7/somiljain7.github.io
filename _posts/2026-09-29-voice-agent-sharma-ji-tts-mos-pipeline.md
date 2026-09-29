---
title: 'The Day Our Voice Agent Couldn’t Say "Sharma Ji" Right'
date: 2026-09-29
permalink: /posts/2026/09/voice-agent-sharma-ji-tts-mos-pipeline/
categories:
  - Engineering
  - Voice AI
tags:
  - TTS
  - MOS
  - Speech Evaluation
  - Hinglish
  - Voice AI
visibility: unlisted
---

A few months ago, someone on our team was trying out a new TTS provider we were considering for a delivery-confirmation flow. The script was simple: confirm the name, read the address back, read the pincode, done. The model hit "Sharma ji" and flattened the honorific like it wasn't there. Then it reached the pincode and started mixing the digits up with the locality name, as if it had never seen an Indian address before. Everyone in the room listened to the playback in silence. Then someone said, "yeah, no customer is sitting through that." That was the origin story of this post.

Text-to-speech is easy to demo and brutally hard to get right at scale — especially in languages like Hindi and Hinglish, where a single sentence can mix scripts, numerals, honorifics, and slang in one breath. At Vaani, we don't just build voices. We built a system whose entire job is to catch our voices being wrong before anyone else hears them.

## The problem with "it sounds good to me"

Early on, our process for judging a new TTS model was exactly what you'd expect. Someone from the team would listen to a handful of sample sentences and go, "yeah, that sounds fine." It worked until it didn't. A model could ace ten polite, well-formed sentences and then fall apart the moment it hit a Hinglish sentence with a mid-word script switch, an address with a mixed-numeral pincode, or an honorific like "ji" tacked onto a name.

The uncomfortable truth is that human ears are great at noticing when something sounds off, but bad at doing it consistently, at scale, across every release. Someone who has been listening to the same model for a week stops hearing its flaws, the way you stop smelling your own kitchen. We needed something that never gets tired, never gets used to a model's quirks, and can run the same test a thousand times without complaint.

So we split "is this voice good?" into two separate questions, because they really are two separate questions:

1. **Does it sound natural?** Does it sound like a real person, or like a machine reading words at you? The industry calls this mean opinion score (MOS).
2. **Can I understand it?** Did it pronounce, switch, and pace itself well enough that the listener gets the right words — not just pleasant-sounding ones? This is intelligibility.

A voice can be warm and human and still garble a pincode. It can be perfectly clear and still be flat and robotic. You need both checks, because they catch different failures. Conflating them is exactly how so many voice products end up sounding great in a demo and falling apart on a real call.

## Pipeline one: does it sound natural? (MOS)

There are already a couple of well-known benchmarks for this, and with all the competition in the Indian voice AI space right now, it's tempting to chase leaderboard numbers. We didn't want to do that. Instead, we built our sentence sets from something more useful than a benchmark: our own scars from running real calling and call-support agents. Over time, you start to notice a pattern. Certain sentences reliably break a voice model. Not exotic edge cases — ordinary ones: a name that needs a mid-sentence language switch, a number that has to be read a particular way, a phrase that needs rhythm and emphasis to sound natural instead of stitched together.

Think of a wedding caterer's order sheet. Any cook can nail a clean, single dish made to order. The real test is the wedding night itself: one table wants it extra spicy, the next wants no onion or garlic, someone asks for more roti halfway through, and it's all happening back to back with no time to prepare. That's the kind of chaos a voice model faces in a real conversation. A clean textbook sentence set never tests for it.

That's the raw material MOS testing runs on: listeners rate how natural, clear, and human each sample sounds on a 1–5 scale. We make sure the sentences we test against are the ones that matter — the ones our own products have watched real voice AI stumble on.

We also did something else. We didn't test our own voices in isolation. We tested them against everyone else in the field — ElevenLabs, Cartesia, Sarvam, and Google TTS. So when we give a score, it's relative to what's actually available today, not relative to our own last release. Every model gets the same adversarial test: same sentences, same conditions.

MOS is built on human perception, so the final score can't come from a computer. It has to come from people who listen and react. Picture a reality-TV singing competition where the judges face away from the stage and score purely on what they hear, knowing nothing about who's singing. That's the setup we built. We generated audio for the entire adversarial set with each competitor model, and ran our own model (which we plan to release shortly) through the exact same process. Then we asked real listeners to rate every sample under the same blind conditions. Nobody scored themselves, and nobody scored a brand name. Everyone scored what they heard.

### Inside the rating console

Rather than run this out of spreadsheets, we built our own internal evaluation console. For each sentence, the console picks three models at random — two other state-of-the-art providers from the set in scope, plus our own — and shuffles the playback order separately for each rater. Raters never see provider names or checkpoint IDs while they score. Each sample is rated on several metrics — naturalness, clarity, pronunciation, pacing — not one lumped number, because a voice can score well on naturalness and fail on pacing, and collapsing that into a single figure hides exactly the differences we're trying to catch. Each rater also logs a confidence rating with every score, and the console tracks replay counts and time spent per sample. So if someone is rushing a queue at 2 a.m., we can tell that apart from someone wrestling with a genuinely hard example.

The blindness only runs one way, and that's the whole trick. The *rater* doesn't know which sample came from which provider, so their score has nothing to anchor a bias to. But every sample is tagged with its origin before it ever enters the platform, so once the ratings come back, we always know which score belongs to which provider. We just never let that information reach the rater first. From there, ratings flow straight to live dashboards: a per-provider leaderboard, a full breakdown of every metric, and a per-rater view showing rating volume, average scores, and time per rating.

![The MOS pipeline: from adversarial sentence set to blind rating to leaderboard](/images/mos-pipeline-flow.png)

## Pipeline Two: Can I Actually Understand It? (Intelligibility)

Naturalness is subjective and needs human listeners. Intelligibility, for the most part, can be automated — which is why it's our main day-to-day check between MOS rounds. Think of it as an extremely picky, tireless listener sitting between "we trained a new model" and "we shipped it."

Here's how it works. We take some text, generate speech from it with our own model and the same competitor models from MOS testing, then run every one of those samples through a *separate* listening system that transcribes them back into text. If the TTS model said what it was supposed to say, the round-trip transcript should closely match the original sentence. If it mispronounced a nasal sound, dropped a soft vowel, or mangled a number, that shows up as a measurable error.

Two standard metrics capture this: word error rate (WER) and character error rate (CER). They're a bit like a spell-checker, except aimed at how a sentence *sounds*, not how it's typed. For Hindi, CER matters more, because Devanagari doesn't behave like English text, and a metric that wasn't designed for the script can lead you to the wrong conclusion. Ours is designed for it. The lower the error rate, the smaller the gap between "sounds okay" and "production-ready" — and that gap can be a few percent, which is one more reason to automate this rather than lean on a tired human at midnight before shipping.

Under the hood, intelligibility testing runs as its own service: an evaluation API that takes a batch of audio, fans it out to STT services, scores each sample, and writes everything — per-sample transcripts, WER and CER per sample, and latency — into a relational database rather than a spreadsheet someone may or may not keep current. That matters because having every past run on record lets us track intelligibility across every checkpoint of a training run, not just the last one before shipping.

![The intelligibility pipeline: from generated speech to round-trip transcription to WER/CER dashboards](/images/stt-eval-pipeline-flow.png)

## The test set is the part you can't see from outside

The hard part wasn't building the scoring framework. It was building the *test* set.

Anyone can write a few hundred clean sentences, but they tell you almost nothing about how a model behaves in a real user's hands. So we wrote sentences that current TTS models find hard to say — the linguistic landmines common to Hindi and Hinglish.

A few of our favorite "bad" sentences, straight from the test suite:

- **"राष्ट्रपति ने स्वतंत्रता दिवस पर अस्पताल के कर्मचारियों को सम्मानित किया"** — a sentence full of vowels that informal Hindi speech routinely drops. You won't find this in a textbook; native speakers just drop those vowels in normal conversation, and models trained on carefully articulated studio recordings don't reproduce it consistently.
- **"सर, आप please थोड़ा wait कीजिए, मैं अभी आता हूँ, भाई"** — which slides from formal ("सर," "कीजिए") to informal ("भाई") inside one sentence. That's how people actually talk on a support line, and a flat, uniformly formal reading strips out the social signal.
- A sentence with both a phone number and a spoken-form date in it. Numbers are their own minefield: plenty of models sound fine on prose and come apart the moment they have to read digits mid-sentence.
- Blunt Hinglish slang and code-switching — "yaar," "abe," and the like — which behave like neither pure Hindi nor pure English, and which most models trained on formal text have never seen.

We built a curated, cleaned-up version of these examples specifically to probe failure modes. A model that clears this suite has genuinely earned it. And because we tag each example by type and difficulty rather than dumping everything into one pool, we can tell you exactly what kind of failure a model is prone to. Is it numbers? Code-switching? Honorifics? — instead of one opaque score you have to take on faith.

## Why we don't trust a single judge

One thing we learned the hard way: even the "listening" system we use to check TTS output has its own blind spots. If we relied on a single transcription engine to score every sentence, we'd be at risk of mistaking *its* limits for *our* model's. It's like only ever asking one person whether your outfit looks good.

So we run each evaluation through several independent listening systems — including an ASR engine built specifically for code-switched Hindi-English speech — and compare their outputs. When they agree on a sentence, that's strong evidence the score is right. When they disagree, we know to look at that sentence more closely rather than trust either number. It sounds like a small design choice, and in a sense it is. But it's the difference between an evaluation metric you can act on and one where you have to hand-check every result anyway. Next, we plan to route those disagreements to human evaluators automatically.

## Why this matters beyond a lab benchmark

None of this is academic. Every test case came from hours spent thinking hard about how real people speak — not how a dataset assumes they do. If an Indian-language voice product is built for clean, textbook input, it isn't ready for an actual user in India, because nobody talks like that.

This pipeline runs quietly in the background every time we consider pushing a model update or cutting a new training checkpoint. No celebration, no press release. Just a steady, unrelenting check asking the same question every time: would this actually sound right to the person listening?

That's our bar. It's why, when you hear Vaani's voice read a sentence aloud, that sentence has already been through a gauntlet built to find the things voice AI usually gets wrong in Indian languages.
