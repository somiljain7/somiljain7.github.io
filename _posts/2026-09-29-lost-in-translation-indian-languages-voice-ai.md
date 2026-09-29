---
title: "Lost in Translation: Why Your Voice Agent Doesn't Understand How India Actually Talks"
date: 2026-09-29
permalink: /posts/2026/09/lost-in-translation-indian-languages-voice-ai/
categories:
  - Engineering
  - Voice AI
tags:
  - Speech Recognition
  - Language Identification
  - Code Switching
  - Voice AI
  - Multilingual
visibility: unlisted
---

Say someone is speaking to a voice agent in a language it simply wasn't built to understand. The model doesn't stay silent and admit defeat, it does something worse: it grabs onto the nearest thing that sounds familiar. A word in Tamil or Telugu might land acoustically close to a completely unrelated word in Hindi or English, and the model, having no real concept of the language it's hearing, latches onto that lookalike and runs with it. The transcription comes out fluent, confident, grammatically clean, and entirely wrong. From the outside it doesn't look like a language problem at all. It looks like the agent just misunderstood you, or worse, that it's not listening. That's a much harder failure to trust, because nothing about it signals that something upstream has gone wrong. The conversation just quietly drifts off a cliff, one confidently mistranscribed word at a time.

That's the experience most voice agents give people today, and it's exactly what's at stake.

When you speak to a voice agent, what do you actually expect? Probably something simple: that it understands you, no matter how you speak. Not just the words, but the way you naturally mix languages, drop into your mother tongue mid sentence, or throw in English words without thinking twice.

That expectation feels reasonable. The reality of building it is anything but.

At Vaani AI Research, we work on voice AI for Indian languages, Hindi, Marathi, Hinglish, Telugu, Tamil, and the gap between that expectation and what today's speech models can deliver is enormous. Efforts like AI4Bharat and BHASHINI are pushing hard on low resource Indian languages, and there's real progress. But anyone building in this space will tell you the same thing: ASR models are either good at one primary language, or reasonably good at two in a bilingual setup. Handling many languages fluidly, in real time, is a different problem altogether.

And English sits at the center of that gap. Most speech research has been built around English, so naturally, it's the strongest across almost every model. Once you move to Hindi, Malayalam, Gujarati, Marathi, or any other Indian language, that strength drops off fast, especially when a second language enters the picture.

Here's where it gets genuinely hard: **code switching**. If you're speaking Hindi with someone, chances are it's not textbook Hindi. You're sliding into English words mid sentence, naturally, without even noticing. That blend, code mixing and code switching, is one of the toughest problems for voice systems to crack. It's not an edge case. It's how people actually talk.

Picture this: you're testing a new voice agent, hoping it'll finally feel natural. You start in Hindi, throw in a few English words the way you always do, and the agent stumbles. It either transcribes gibberish, or worse, misunderstands entirely. You didn't do anything unusual. You just spoke the way you normally speak. That disconnect, between what feels like a small, natural switch to a person and what turns into a system failure, sums up the whole problem. Multilingual models often work fine for **batch processing**, transcribing recorded files after the fact, but **real time streaming is where they fall apart**.

We've tested a considerable number of ASR models at Vaani. Many advertise low latency and solid multilingual support. In practice, most Hindi focused models handle some English reasonably well, largely because colloquial Hindi already blends English words in. That makes the Hindi-English bilingual case somewhat more forgiving. But the moment a model is boxed into just two languages, and the person speaking isn't fully comfortable in either, the whole system breaks down.

One thing that genuinely helps here is real time language detection running as its own layer. There's been good research in this direction. Teams have run language diarization challenges, identifying which language was spoken at which timestamp, in recent years. But these challenges were largely built for offline evaluation, not live conversation. Detecting language on the fly, turn by turn, is a fundamentally harder problem.

We ran our own experiments here too. Strong language identification models exist, ECAPA-TDNN from SpeechBrain, or even repurposing Whisper for language ID, but they're heavy. Bolting on an entirely separate model just to detect language, on top of your primary speech-to-text pipeline and its fallback, adds real overhead. You're essentially running a second ASR just to answer one question: what language is this?

There's a deeper constraint too. Most language identification models need a decent chunk of audio to make a confident call. They're not built to classify language from a few hundred milliseconds of continuous streaming audio, and that's exactly the granularity real conversations demand.

It's worth being precise about why this matters, because it's easy to mistake language identification for a **latency problem**. It isn't, really. Over the course of a conversation, knowing what language is being spoken doesn't need to happen in milliseconds, it needs to happen correctly. **The real value is accuracy and robustness across languages, not speed.** And that's exactly what makes it so easy to overlook. Think about what happens when a **Hindi STT model is fed Tamil audio**. It doesn't raise a flag or ask for help, it just **outputs blank**, or worse, confidently transcribes something that isn't there. There's no error, no crash, nothing that shows up in your logs as a failure. **The conversation just silently breaks.** That's the real risk with skipping language identification entirely: it's not that the system slows down, **it's that it fails quietly, in exactly the scenarios where getting it wrong matters most**.

This is a problem we've run into first hand. We had a client come to us wanting a voice agent that felt truly bilingual, one that wouldn't flinch when a caller slipped between Hindi and English mid sentence. The usual playbook would have been to stitch together a primary STT, a fallback STT, and then a separate language detection model running alongside just to decide which one should be listening. It works, technically, but it's slow, it's expensive to run, and every extra hop is another place for latency to creep in.

![Traditional multi-model pipeline for language detection](/images/traditional-pipeline.png)

So instead of reaching for the standard labeling industry approach of chaining models together, we asked a different question. What if language detection didn't need its own dedicated model at all? We ran an experimental pass using Google's Gemma edge models, the 2B and 4B versions, which come with a native audio tokenizer built in rather than needing one bolted on. The results held up well: **97.14% overall accuracy** across the Indian languages we tested, with **Hindi, Kannada, Marathi, Tamil, and Telugu all hitting 100%**, and Bengali and Gujarati close behind at 90%. End-to-end latency averaged **around 0.3 seconds**, with time to first token sitting around **180 milliseconds**, comfortably inside the budget a live conversation can absorb, and a **real-time factor well under 1x** throughout, meaning the model was never the thing slowing the conversation down. That one experiment reshaped how we think about the pipeline entirely, and **it's the kind of exploratory work that ends up defining how we approach every client after**.

That same exploration led us somewhere else too. Once we had a model that could listen and understand context natively, we started asking whether it could pick up on something harder than language, how someone is actually feeling while they speak. Emotion detection in voice AI usually leans on the acoustic signal alone, pitch, pace, tone, the things a voice does when someone's frustrated or upset. That's useful, but it's only half the picture. The other half is in what someone is actually saying and how they're saying it. Someone who's getting annoyed on a call tends to ask shorter, sharper questions, or repeat themselves, or push back more directly. That's a semantic signal, not an acoustic one, and it's just as telling.

We ran a separate round of experiments looking at exactly this, using the same underlying approach to see whether a model could read emotional cues from the text of what someone says, not just the sound of it. Early results were promising enough that we think this combined view, tone plus semantics, is where emotionally aware voice agents actually need to head, rather than leaning on pitch analysis alone. It's early work, but it's the kind of direction that convinces us we're asking the right questions, not just running the usual benchmarks.

Research efforts like the DISPLACE challenge, run jointly by teams at IISc Bangalore and NIT Karnataka, have tried to formally benchmark the language diarization problem. Their datasets deliberately capture natural, unscripted, multi-speaker conversations with real code mixing, specifically because that's what breaks lab-trained systems. The conclusion across multiple editions of this challenge has been consistent: even with large, dedicated, natural conversational data built for exactly this problem, language diarization remains genuinely hard to solve well.

But here's the deeper mismatch. DISPLACE, like most academic benchmarks in this space, is evaluated offline, on complete audio files, after the fact. A voice agent doesn't get that luxury. Everything is a live, continuous stream, and a decision has to be made turn by turn, in real time.

**This is where we think the real opportunity lies.** A model built with native audio understanding from the ground up doesn't need a separate system bolted on for every new signal you want to detect. The same backbone can be extended to handle language identification and emotional cues together, almost like a mixture of experts setup, natively within a streaming pipeline. It collapses the "extra model for every signal" problem into a single, unified, streaming native foundation, and that's the direction we're building Vaani around.

![Unified streaming-native pipeline](/images/unified-pipeline.png)

Transcription itself remains a separate, still very much unsolved problem. This isn't a claim that one model fixes everything. But for language and emotion detection specifically, moving toward compact, streaming native, multimodal models feels like the direction this space has to go, and it's exactly the kind of problem we enjoy chasing down at Vaani.

The bigger point stands: **language isn't a feature you bolt onto a voice agent. It's the foundation the entire conversation is built on.** Until code switching, real time language detection, and genuine emotional understanding are solved properly, we're building agents that understand language in theory, but not the way people actually speak it.

## References

- DISPLACE Challenge 2023, [challenge site](https://displace2023.github.io/), [paper](https://arxiv.org/abs/2303.00830), [results summary](https://arxiv.org/abs/2311.12564)
- DISPLACE Challenge 2024, [challenge site](https://displace2024.github.io/), [paper](https://arxiv.org/abs/2406.09494)
- Google Gemma 3n (E2B / E4B), [model card](https://huggingface.co/google/gemma-3n-E2B)
- SpeechBrain ECAPA-TDNN for Language Identification, [model card](https://huggingface.co/speechbrain/lang-id-commonlanguage_ecapa)
