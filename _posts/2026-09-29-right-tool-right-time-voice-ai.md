---
title: "Right Tool, Right Time: Fixing Voice AI's Biggest Blind Spot"
date: 2026-09-29
permalink: /posts/2026/09/right-tool-right-time-voice-ai/
categories:
  - Engineering
  - Voice AI
tags:
  - Function Calling
  - Gemma
  - Voice AI
  - Tool Use
  - Latency
visibility: unlisted
---

*From the Vaani AI Research team*

Give an AI agent access to your business tools, and it should be able to do anything: book appointments, look up history, escalate when needed. Then you turn it on, and reality shows up.

The agent skips a tool it should call. It calls another one four times in a row like it forgot it already did. It mixes up two tools that look nothing alike to a human and everything alike to a language model. It tells a customer "I've sent that confirmation" when the email service quietly failed.

One early test case has stuck with us. A caller said exactly one thing: *"I want to talk later."* No date, no time, nothing else. The agent booked a callback anyway, for a specific date, at a specific hour, with total confidence. The caller never said either; the model had lifted both from an earlier, unrelated example and presented them back as fact.

This is what we learned fixing it.

## The problem isn't model intelligence

Start with what we were actually working with: a roughly 270-million-parameter Gemma model, the size class Google itself positions as small enough to run directly on a phone. Genuinely capable for its size, and exactly the kind of model you want powering a live voice agent: fast, cheap, low-latency by design.

Out of the box, though, its accuracy on the decisions a voice agent has to make constantly, which tool, right now, with what information, wasn't close to good enough for production. That gap was never really about the model being "dumb." A model that size was never going to intuit a dozen unfamiliar tools from short descriptions the way a much bigger model might get lucky doing. It needed real help.

Our first instinct was the obvious one anyway: swap in a bigger, smarter model. It didn't fix things, and it broke the one thing that made the small model worth using in the first place: speed. That's when we stopped treating this as a capability problem and started treating it as an **architecture problem**.

Every tool call is actually several decisions at once: do I need a tool at all, which one, is this the right moment, do I have what it needs, have I already called it, what do I do with the result. Asking one model to juggle all of that, every turn, is like hiring one person to be the listener, the memory, the decision-maker, and the state-tracker simultaneously. It's not incapable, it's overloaded.

![One model trying to do six jobs at once, feeding into a single response](/images/01_one_model_too_many_jobs.png)

## Similar tools are the model's blind spot

A "reschedule appointment" tool and a "create new booking" tool look obviously different to a person. To a model reading two terse descriptions, they look suspiciously alike, both take a timestamp, both touch a calendar. Pick the wrong one and a customer gets a duplicate booking instead of a rescheduled call. The more tools you add, the harder this gets, not because the model gets dumber, but because every new tool is another near-miss to rule out under time pressure.

## Judgment tools need their own lane

Some tools aren't fact-lookups, they're judgment calls. Take escalation: when should an agent actually transfer to a human? Not the instant someone says "let me talk to someone" (sometimes that's just frustration passing). It's when the agent has genuinely tried and failed, the request is out of scope, or there's a safety signal. A generic model reading "this tool escalates to a human" has no way to know that, it'll escalate too eagerly, never, or at exactly the wrong moment.

We hit the same wall with something that sounds trivial: ending the call. On paper, `end_call` is a one-line function, the conversation's over, hang up. In practice, deciding whether a conversation is actually over is a judgment call every single time. A customer saying "okay, bye" while still mid-thought isn't done. One that goes quiet after getting an answer might be. Get it wrong one way and you cut someone off; get it wrong the other and the agent lingers on a call that should have ended, sounding confused and burning time neither side has. We ended up running an actual whiteboard session dedicated to nothing but this, mapping out, case by case, what "genuinely over" looks like versus what merely sounds like it, before trusting a model to make that call unsupervised.

That kind of reasoning is expensive to ask of the same model that's carrying the live conversation. Loading one thread of thought with "keep talking naturally" and "reason carefully about whether to escalate" at the same time means asking it to do two very different jobs at once. So we don't. Tool-calling decisions, cognitive ones especially, run as their own step, on their own thread, alongside the conversation rather than inside it. The customer keeps talking; the decision gets made in parallel, not queued behind it.

## The clock is the real enemy

Here's the part the industry doesn't talk about enough: in voice, being right slowly is often worse than being wrong quickly. A chatbot user tolerates a three-second pause. A person on a phone call doesn't; by two seconds of dead air, the call feels broken. A tool call isn't free thinking time, it's live silence while the model decides, the tool runs, and the result becomes something to say.

Every failure above costs more than it looks like on a transcript because of this. A duplicate call burns a second live decision cycle. A wrong-tool pick that has to be caught and corrected is audible hesitation. At thousands of calls a day, latency isn't a nice-to-have, it decides whether the product feels natural or broken. It's also why "use a bigger model" was never the answer: bigger models think slower, and slower thinking is a customer sitting in silence. We treat tool-calling decisions as part of the same speed budget as the rest of the conversation, not a separate, slower lane, the same discipline behind the sub-200ms time-to-first-token latency we target for the voice itself.

Some calls genuinely need more than one tool at once, not one after another. Getting that right, multiple tool calls running in parallel without stepping on each other, race conditions, tools that depend on another finishing first, deciding what shouldn't run in parallel, took real engineering hours to get solid. It was worth it: the system supports parallel tool calls, so a call that needs two things done doesn't make the customer wait through them one at a time.

## The context-length ceiling

Every tool costs tokens before a word of real conversation happens. That budget doesn't grow as the call goes on, so as the customer talks, backtracks, and adds detail, something has to give. What usually gives is exactly what you need most: the model's memory of what it already asked or already called. This is why tool repetition and the silent-tool problem below often share a root cause, if the model can't hold "I already called this three turns ago" in context, it isn't confused, it genuinely doesn't have the information anymore. This squeeze hits smaller, faster models hardest, exactly the ones you want in production, so "use a bigger model" only pushes the ceiling a little further away rather than removing it.

![Tool instructions and growing conversation both competing for the same limited window, until older details get pushed out](/images/03_context_squeeze.png)

## The silent-tool problem

Some tools succeed but don't say much back: "log this interaction," "send a confirmation," "hold the call" often return nothing more than an "ok." Models expect acting to produce something worth interpreting, so when a tool comes back empty, they fill the gap, assuming success and inventing what must have happened.

We caught this one by accident, listening to a call rather than reading a metric. The agent told a customer, warmly and without hesitation, that a confirmation was on its way. It wasn't; the email service had timed out seconds earlier. Nothing in the transcript looked wrong, which is exactly what made it dangerous.

![A tool runs silently in the background while the model, hearing nothing back, assumes success and tells the customer it worked](/images/02_silent_tool_trap.png)

## Not every tool fails the same way

Simple lookups (one intent, one parameter) are the easy case. Fire-and-forget tools trigger the silent-tool problem above. Multi-turn tools, where the needed information only exists after several turns, are the ones most exposed to the context squeeze. Judgment tools need situational reasoning a short description can't capture. Sequence-dependent tools only make sense after something else already happened, so the model has to track order, not just content. Treating all of them as one flat list of functions is where most of the trouble starts.

## What we tried, and what it taught us

Before touching the architecture, it's worth showing what the untouched base model did with an easy case. A customer, clearly mid-wedding-chaos, said something completely ordinary: "I'm busy right now, call me back on the 3rd of July at quarter past ten." The agent had a callback tool built for exactly this. What it said back was a canned apology: it "cannot assist with booking or rescheduling appointments." No tool call, no attempt, just a polite refusal to do the one thing it existed to do. That wasn't a one-off, flat refusal dressed up as an apology was the single largest category of failure we saw, roughly four out of every five failed calls.

So we ran experiments. **In-context examples instead of retraining** was the cheapest fix: drop example conversations into the prompt and hope the model picks up the pattern. It didn't work. The model latched onto whichever example sat closest to the live conversation, bleeding field names and even fabricated dates and bookings from the examples into real customer interactions, as if they'd actually been said.

**What the model does with incomplete information** was more revealing. Asked to resolve a relative date like "tomorrow," the model consistently filled in something rather than pausing to ask. One customer asked for an appointment "tomorrow"; the agent booked it, at midnight, having treated "tomorrow" as a date and then invented a time to go with it.

Hindi made this more interesting, not less: "kal" means both "yesterday" and "tomorrow," and the model, forced to guess, once rescheduled someone into a slot that had already passed. Indian English added its own flavor: "Myself is Suresh, calling for my mother's appointment" is a completely normal sentence to anyone who grew up around Indian call centers, but a model expecting "I am X" occasionally filed "Myself" as the actual customer name. Somewhere in a test log there's a confirmed appointment for a customer named Myself.

**Rewording alone**, before touching the model itself, got us a real but partial gain: right-tool selection improved roughly 30% relative to where we started, and false escalations dropped by more than half. But getting every detail exactly right stayed stubbornly rare, confirming that better wording narrows the gap without closing it.

The throughline: the base model's failures weren't random noise, they were consistent, explainable patterns, which is what convinced us this needed architecture, not prompting.

## What we actually changed

We won't walk through the exact recipe, that's our edge, and it's still evolving. But at a high level: we fine-tuned the model itself on our own tools and scenarios, rather than leaning on a generic, off-the-shelf function-calling model to figure our domain out on its own. Alongside that, we moved responsibility out of a single model's head and into the surrounding system: tool selection narrowed down before the model had to choose, descriptions turned into real constraints instead of passive documentation, and conversation state tracked explicitly by the system instead of left to memory. A meaningful share of the actual effort went into building and curating the training scenarios themselves, across languages and code-mixed dialects, work that turned out to matter as much as the fine-tuning itself.

None of this required a fundamentally smarter model. It required treating reliability as something you engineer around the model.

## What changed for us

Measured on the same test scenarios we used to characterize the original problem: correctly identifying which tool a situation calls for went from under 7 out of 100 calls to 90 out of 100, on the same roughly 270-million-parameter model the whole way through, no upgrade, no bigger model quietly doing the work behind the scenes.

Getting the argument values right too improved from essentially never to better than 3 out of 5 calls. Most of what's still missing there is formatting-level, and a fair amount of it never reaches a customer: a validation step catches malformed values before anything executes.

Duplicate calls dropped. Escalations started happening closer to when they were actually needed. The agent stopped confidently narrating outcomes that hadn't occurred. We're not calling this finished, a system that's right nine times out of ten on tool selection, and getting steadily more precise on the details underneath, is the real shape of progress here.

Here are the receipts, on the exact same phone-sized model the whole way through, no secret bigger model quietly doing the heavy lifting behind the scenes:

- Tool selection accuracy: **6.8% → 90%**, roughly 13x more likely to pick the right tool than where we started
- Argument-level accuracy: **1.55% → 60.35%**
- Fine-tuned on our own tools and scenarios, not a generic off-the-shelf function-calling setup
- Parallel tool calls supported, not just sequential ones
- All of it on a roughly 270-million-parameter model, small enough to run on a phone

## The takeaway

Most teams treat tool access as a checkbox: wire up the functions, write a short description, ship it. It works in the demo and quietly falls apart in production, and because the failures are often silent, nobody notices until a customer does.

Reliable function calling doesn't come from the next foundation-model breakthrough, and it doesn't come from a bigger model either, since a bigger model is also a slower one. It comes from architecture: specializing the model that makes the decision, managing which tools are in play, writing contracts that actually constrain behavior, tracking state explicitly, running decisions in parallel with the conversation instead of blocking it, and doing all of it inside a latency budget tight enough that the customer never notices a decision was made.

That combination, right *and* fast, on every single turn of a real phone call, is the part that's genuinely hard to copy. It's the part we've been building at Vaani, and on a model this small, we're just getting started.
