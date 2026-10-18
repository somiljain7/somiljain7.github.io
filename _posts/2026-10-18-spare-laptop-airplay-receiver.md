---
title: "Turning a Slow Spare Laptop into a Free AirPlay Receiver"
date: 2026-10-18
categories: [Engineering, Projects]
tags: [airplay, windows, networking, mdns, gpu, side-project, homelab]
mood: tinkering
visibility: public
pinned: false
excerpt: "How I used an old Windows laptop as a wireless screen for my iPhone, iPad and other laptop, what is actually happening under the hood, and where the RAM goes."
---

<style>
.post-content:has(.ap-hero) p{margin:0 0 1.15em}
.post-content:has(.ap-hero) h2{margin-top:2.2em}
.ap-hero{margin:8px 0 34px;padding:22px 24px;border-radius:16px;border:1px solid color-mix(in srgb,var(--accent,#0d9488) 35%,transparent);background:linear-gradient(150deg,color-mix(in srgb,var(--accent,#0d9488) 12%,transparent),color-mix(in srgb,currentColor 3%,transparent))}
.ap-kicker{font-family:var(--font-mono,ui-monospace,monospace);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:color-mix(in srgb,var(--accent,#0d9488) 62%,currentColor);font-weight:700}
.post-content .ap-hero p.ap-lede{margin:10px 0 18px;font-size:1.08em;line-height:1.6;opacity:.85}
.ap-pills{display:flex;flex-wrap:wrap;gap:8px}
.ap-pill{padding:4px 12px;border-radius:99px;font-size:12.5px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);background:color-mix(in srgb,currentColor 4%,transparent)}
.ap-pill b{color:color-mix(in srgb,var(--accent,#0d9488) 62%,currentColor)}
.ap-fig{margin:28px 0;padding:22px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:16px;background:color-mix(in srgb,currentColor 3.5%,transparent)}
.ap-fig h4{margin:0 0 4px;font-size:15px}
.post-content .ap-fig .ap-sub{margin:0 0 18px;font-size:13px;opacity:.65}
.post-content .ap-cap{margin:16px 0 0;font-size:12.5px;opacity:.6}
.ap-setup{display:grid;grid-template-columns:minmax(0,1fr) 28px minmax(0,1.5fr) 28px minmax(0,1fr);align-items:center;gap:6px}
.ap-senders{display:grid;gap:10px}
.ap-box{padding:12px 14px;border-radius:12px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);background:color-mix(in srgb,currentColor 4%,transparent);font-weight:600;font-size:14.5px;line-height:1.35}
.ap-box small{display:block;font-weight:400;font-size:12.5px;opacity:.7;margin-top:4px}
.ap-box.ap-main{padding:18px;border:2px solid var(--accent,#0d9488);background:color-mix(in srgb,var(--accent,#0d9488) 10%,transparent)}
.ap-box.ap-main .ap-kicker{font-size:11px}
.ap-box.ap-main strong{display:block;margin:6px 0 8px;font-size:18px}
.ap-box.ap-main span{display:block;font-weight:400;font-size:13.5px;line-height:1.7;opacity:.85}
.ap-arrow{height:2px;background:color-mix(in srgb,currentColor 35%,transparent);position:relative}
.ap-arrow:after{content:"";position:absolute;right:-1px;top:-5px;border-left:8px solid color-mix(in srgb,currentColor 35%,transparent);border-top:6px solid transparent;border-bottom:6px solid transparent}
.ap-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;counter-reset:ap}
.ap-step{position:relative;padding:16px;border-radius:14px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);background:color-mix(in srgb,currentColor 3%,transparent)}
.ap-step.ap-main{border:2px solid var(--accent,#0d9488);background:color-mix(in srgb,var(--accent,#0d9488) 10%,transparent)}
.ap-step .ap-n{font-family:var(--font-mono,ui-monospace,monospace);font-size:13px;font-weight:700;color:color-mix(in srgb,var(--accent,#0d9488) 62%,currentColor)}
.ap-step strong{display:block;margin:4px 0 6px;font-size:16px}
.ap-step code{display:inline-block;margin-bottom:8px;font-size:12px}
.ap-step span{display:block;font-size:13.5px;line-height:1.5;opacity:.85}
.ap-key{margin:24px 0;padding:16px 20px;border-radius:14px;border:1px dashed color-mix(in srgb,var(--accent,#0d9488) 55%,transparent);font-size:1.03em;line-height:1.65}
.ap-key b{color:color-mix(in srgb,var(--accent,#0d9488) 62%,currentColor)}
.ap-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:20px 0}
.ap-cell{padding:14px 16px;border-radius:12px;border:1px solid color-mix(in srgb,currentColor 14%,transparent);font-size:14px;line-height:1.55}
.ap-cell b{display:block;margin-bottom:4px;font-size:14.5px}
.ap-cell.ap-hot{border-color:color-mix(in srgb,#f08a3c 55%,transparent);background:color-mix(in srgb,#f08a3c 7%,transparent)}
.ap-cell.ap-hot b{color:#e0661f}
.ap-fix{display:grid;gap:12px;margin:20px 0}
.ap-fixrow{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:12px;overflow:hidden}
.ap-fixrow>div{padding:14px 16px;font-size:14px;line-height:1.55}
.ap-fixrow>div:first-child{background:color-mix(in srgb,#f08a3c 8%,transparent);font-weight:600}
.ap-fixrow>div:first-child small{display:block;font-weight:400;opacity:.7;margin-top:4px}
.ap-fixrow .ap-tag{display:block;font-family:var(--font-mono,ui-monospace,monospace);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px;opacity:.7;font-weight:700}
.post-content .ap-list{counter-reset:ap;list-style:none;margin:20px 0;padding:0;display:grid;gap:10px}
.post-content .ap-list li{counter-increment:ap;position:relative;margin:0;padding:14px 16px 14px 58px;border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:12px;line-height:1.6}
.post-content .ap-list li:before{content:counter(ap);position:absolute;left:14px;top:12px;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-weight:800;font-size:14px;color:var(--bg,#fff);background:var(--accent,#0d9488)}
.ap-repo{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:28px 0 8px;padding:18px 20px;border-radius:14px;border:1px solid color-mix(in srgb,var(--accent,#0d9488) 40%,transparent);background:color-mix(in srgb,var(--accent,#0d9488) 8%,transparent)}
.ap-repo span{font-size:14px;opacity:.8}
.post-content .ap-repo a{display:inline-block;padding:9px 16px;border-radius:10px;background:var(--accent,#0d9488);color:var(--bg,#fff);text-decoration:none;font-weight:700;font-size:14px}
@media (max-width:700px){.ap-setup{grid-template-columns:1fr}.ap-arrow{width:2px;height:22px;margin:0 auto}.ap-arrow:after{right:-5px;top:auto;bottom:-2px;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid color-mix(in srgb,currentColor 35%,transparent);border-bottom:0}.ap-steps{grid-template-columns:1fr 1fr}.ap-fixrow{grid-template-columns:1fr}}
@media (max-width:420px){.ap-steps{grid-template-columns:1fr}}
</style>

<div class="ap-hero">
<div class="ap-kicker">NetworkCastHub</div>
<p class="ap-lede">An old Windows laptop with a weak processor, turned into a wireless screen for an iPhone, an iPad and another laptop. No cables, no subscription, no trial timers.</p>
<div class="ap-pills"><span class="ap-pill"><b>3</b> senders, 1 receiver</span><span class="ap-pill"><b>UDP 5353</b> discovery</span><span class="ap-pill"><b>TCP 7000</b> handshake</span><span class="ap-pill"><b>GPU</b> does the decoding</span><span class="ap-pill">about <b>10 min</b> to set up</span></div>
</div>

## The itch

I had a Windows laptop sitting in a drawer. Its processor is too weak for real work, but the screen is fine and it still runs Windows. I also had an iPhone, an iPad and a second laptop that I kept wanting to show on a bigger display.

So the plan was simple: **plug the spare laptop into a monitor, and make it a wireless receiver.** Anything I want on the big screen gets cast to it, with no cables, no subscriptions and no trial timers.

That last part mattered. I tried a few Store apps first. One worked but started a 15 minute trial countdown the moment the stream began. Out it went.

## What I ended up with

I wrapped everything in a small repo called NetworkCastHub. It does three things:

<div class="ap-grid">
<div class="ap-cell"><b>AirPlay screen mirroring</b>From iPhone or iPad to the spare laptop, with audio.</div>
<div class="ap-cell"><b>YouTube casting</b>Through a TV-style receiver page, because plain mirroring blanks out protected video.</div>
<div class="ap-cell"><b>One-click hotspot toggle</b>So the other laptop can join through the spare machine when there is no shared network.</div>
</div>

The actual AirPlay receiver is an open source Windows engine (native C++, SDL2, hardware video decode). My repo is the glue: installer, shortcuts and a small menu.

<div class="ap-fig">
<h4>One spare laptop becomes the screen for every device</h4>
<p class="ap-sub">Same Wi-Fi, or the hotspot toggle when there is no shared network.</p>
<div class="ap-setup">
<div class="ap-senders"><div class="ap-box">iPhone</div><div class="ap-box">iPad</div><div class="ap-box">Other laptop</div></div>
<div class="ap-arrow"></div>
<div class="ap-box ap-main"><div class="ap-kicker">The receiver</div><strong>Spare Windows laptop</strong><span>Receives the stream<br>Decodes on the GPU<br>Shows it in a window</span></div>
<div class="ap-arrow"></div>
<div class="ap-box">Screen<small>Its own, or an attached monitor</small></div>
</div>
</div>

## How casting actually works

When you tap Screen Mirroring on an iPhone, four things happen in order.

<div class="ap-fig">
<h4>Four steps from tap to picture</h4>
<p class="ap-sub">The phone does the encoding. The laptop only decrypts, decodes and draws.</p>
<div class="ap-steps">
<div class="ap-step"><div class="ap-n">01</div><strong>Discovery</strong><code>UDP 5353</code><span>Phone asks who offers AirPlay</span></div>
<div class="ap-step"><div class="ap-n">02</div><strong>Handshake</strong><code>TCP 7000</code><span>Pair, swap keys, agree on format</span></div>
<div class="ap-step"><div class="ap-n">03</div><strong>The stream</strong><code>H.264 / HEVC</code><span>Encrypted, sent over the network</span></div>
<div class="ap-step ap-main"><div class="ap-n">04</div><strong>Decode, show</strong><code>CPU + GPU</code><span>Decrypt on the CPU, decode on the GPU, draw the window</span></div>
</div>
<p class="ap-cap">Ports 5353 and 7000 are only the start: audio and timing use extra dynamic UDP ports.</p>
</div>

**1. Discovery.** The phone does not know your laptop exists. It sends a multicast DNS query on the local network asking who offers AirPlay. The receiver listens on UDP port 5353 and answers with two service names, one for video and screen mirroring and one for audio. That is why the laptop shows up in the list with no setup.

**2. Handshake.** After you tap the receiver, the phone opens a control connection to the laptop on TCP port 7000. The two sides pair, exchange keys and agree on resolution, frame rate and which ports to use for the media streams. Mirroring also goes through Apple's own key exchange, which open receivers have reimplemented.

**3. The stream.** The phone compresses its screen with its hardware encoder into H.264 or HEVC and sends it over the network, encrypted. It uses additional dynamic UDP ports for audio and timing, which matters later for the firewall.

**4. Decode and display.** The laptop decrypts the packets, hands the video to the GPU's hardware decoder, and draws the frames in a window. Pressing F toggles fullscreen.

<div class="ap-key"><b>The key point for a weak machine:</b> the laptop never has to encode or think about your content. It only decrypts and decodes, and decoding is exactly what GPU video blocks are built for.</div>

## Why a weak CPU is fine

A slow processor hurts when it has to do general work: compiling, browsing with twenty tabs, running an IDE. A receiver does a narrow job. Network packets arrive, get decrypted (cheap), get decoded on the GPU's video engine, and get shown. The heavy lifting is on the phone, which encodes the stream, and on the laptop's video decoder, which is separate silicon from the CPU cores.

That is why an old machine can mirror a phone smoothly even when it struggles with everyday apps.

## Where the RAM goes

The receiver is a native program, not a browser engine wrapped in an app. Its memory goes to a handful of places:

<div class="ap-grid">
<div class="ap-cell"><b>The program and its libraries</b>The engine, SDL2 and the graphics runtime.</div>
<div class="ap-cell"><b>Network buffers</b>Incoming packets held briefly so the video stays smooth.</div>
<div class="ap-cell"><b>Decoder surfaces</b>A small pool of frames the decoder works with. Many live in video memory, not system RAM, a big reason system RAM stays low.</div>
<div class="ap-cell"><b>The window and swap chain</b>Whatever is needed to draw one window at your resolution.</div>
<div class="ap-cell"><b>Discovery</b>The mDNS listener is tiny.</div>
<div class="ap-cell ap-hot"><b>YouTube TV mode</b>A different story: it runs a full browser window, so expect it to cost noticeably more than the AirPlay receiver.</div>
</div>

Don't take my word for the numbers. Measure on your own machine while mirroring:

```powershell
Get-Process airplay-windows | Select-Object Name,
  @{n='WorkingSet_MB'; e={[math]::Round($_.WorkingSet64/1MB)}},
  @{n='Private_MB';    e={[math]::Round($_.PrivateMemorySize64/1MB)}}
```

For GPU use, open Task Manager, go to the Details tab, and add the GPU and Dedicated GPU memory columns. Watch the Video Decode engine in the Performance tab.

## Attaching the other laptop

The second laptop only needs to reach the receiver. If both are on the same Wi-Fi, nothing special is needed. When they aren't, the hub's hotspot toggle turns on Windows Mobile Hotspot through the Windows Runtime tethering API, and the second laptop joins it. Whether the Wi-Fi card can stay on your home network and run a hotspot at the same time depends on the driver, so check yours.

I tested iPhone mirroring. The iPad uses the same AirPlay protocol, so the same path applies.

## The gotchas I hit

<div class="ap-fix">
<div class="ap-fixrow"><div><span class="ap-tag">Problem</span>Empty Screen Mirroring list</div><div><span class="ap-tag">Fix</span>My Wi-Fi was set to a Public network, and Windows blocks unsolicited inbound traffic there. Setting it to Private fixed discovery.</div></div>
<div class="ap-fixrow"><div><span class="ap-tag">Problem</span>Firewall rules</div><div><span class="ap-tag">Fix</span>AirPlay uses more than ports 5353 and 7000, because audio and timing use dynamic UDP ports. Allowing the program through the firewall is more reliable than opening ports one by one.</div></div>
<div class="ap-fixrow"><div><span class="ap-tag">Problem</span>No window appeared</div><div><span class="ap-tag">Fix</span>The stream connected but nothing showed. Launching the receiver from the interactive desktop (for example through Explorer) fixed it.</div></div>
<div class="ap-fixrow"><div><span class="ap-tag">Problem</span>Black screen on YouTube</div><div><span class="ap-tag">Fix</span>Protected video is not rendered into a mirror. I pair the phone with a TV-style receiver page using YouTube's Link with TV code instead. The phone becomes a remote and the video plays directly on the laptop.</div></div>
</div>

## Setting it up

<ol class="ap-list">
<li>Clone the repo and run <code>setup.bat</code>. It downloads the receiver engine and creates desktop shortcuts.</li>
<li>Set your Wi-Fi to a Private network, then launch the AirPlay shortcut.</li>
<li>On the phone, open Control Center, tap Screen Mirroring, and pick the receiver.</li>
</ol>

## Limits worth knowing

- It is mirroring, not full AirPlay video hand-off, so protected video apps may show black.
- The receiver engine is a third-party project. Read its license and pin the version you trust.
- The YouTube TV trick depends on YouTube keeping that page working.
- Hotspot sharing depends on your Wi-Fi driver.

## Wrap-up

A spare laptop with a weak processor is a perfectly good wireless screen. The receiver does little work, the GPU decoder does the rest, and the memory footprint stays small. If you have a drawer laptop and a monitor, it takes about ten minutes.

<div class="ap-repo"><span>NetworkCastHub: installer, shortcuts and the cast menu</span><a href="https://github.com/somiljain7/network-hub">View the code on GitHub</a></div>
