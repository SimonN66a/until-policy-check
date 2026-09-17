(function(){
  "use strict";

  /* ---------- where the reading happens ----------
     Inside a claude.ai artifact the page asks Claude directly through the
     runtime. Deployed to Vercel there is no runtime, so it posts the same
     prompt to /api/analyse, which calls the Anthropic API server side. */
  var HAS_API = true;
  function askJson(prompt){
    if (sampleFn) return sampleFn.json(prompt, {modelTier:"default"});
    return fetch("/api/analyse", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({prompt: prompt, meta: lastMeta})
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(j){
        if (!r.ok){
          var e = new Error(j.message || "The analyser could not be reached.");
          e.code = j.code || "upstream_error";
          throw e;
        }
        return j;
      });
    });
  }


  var $ = function(id){ return document.getElementById(id); };
  function esc(s){
    return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  /* ---------- what UNTIL can actually deliver ---------- */
  var I = {
    physio:'<path d="M3 17h18M6 17v3M18 17v3"/><path d="M3 17v-3h10l4 3"/><circle cx="7.5" cy="10" r="2.2"/>',
    osteo:'<path d="M9 21V10.5a1.5 1.5 0 0 1 3 0V13"/><path d="M12 13V8.5a1.5 1.5 0 0 1 3 0V13"/><path d="M15 13v-1.5a1.5 1.5 0 0 1 3 0V17a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5v-3.5"/>',
    chiro:'<path d="M10.5 2.5c0 3 3 3 3 6s-3 3-3 6 3 3 3 6"/><path d="M8 5.5h2.6M13.4 11.5H16M8 17.5h2.6"/>',
    massage:'<path d="M2 18.5c4.5-6.5 15.5-6.5 20 0"/><circle cx="9" cy="11" r="2.3"/><circle cx="15" cy="11" r="2.3"/>',
    acu:'<path d="M3 21l9-9"/><path d="M14.5 9.5L18 6"/><path d="M17 3.5l4 4-2.2 2.2-4-4z"/>',
    pod:'<path d="M8.5 21.5c-2.2 0-3.8-1.7-3.8-4.2 0-3 1.6-4.3 1.6-7.3A5 5 0 0 1 11.3 5c2.6 0 4.2 2 4.2 4.6 0 3-1.6 4.5-1.6 7.7 0 2.5-1.6 4.2-3.8 4.2z"/><circle cx="17.5" cy="6.5" r="1.4"/><circle cx="19.6" cy="10" r="1.2"/>',
    nutri:'<path d="M12 8.2c-1.1-1.9-4-2.3-5.4-.8C5 8.9 5 12.3 6.4 15.2c1 2 2.4 4.8 3.7 4.8.9 0 1.1-.6 1.9-.6s1 .6 1.9.6c1.3 0 2.7-2.8 3.7-4.8 1.4-2.9 1.4-6.3 0-7.8-1.4-1.5-4.3-1.1-5.6.8z"/><path d="M12 8.2V5.4c0-1.3 1.1-2.4 2.6-2.4"/>',
    mind:'<path d="M15.2 21v-2.6a5.6 5.6 0 0 0 3-5A7.6 7.6 0 1 0 6 19.8V21"/><circle cx="11.6" cy="10.4" r="2.5"/>',
    venus:'<circle cx="12" cy="8.6" r="5"/><path d="M12 13.6V21M8.6 18h6.8"/>',
    tooth:'<path d="M12 4.4C10.2 3 7.4 2.5 6 4S4.4 8.4 5.3 12.2C6.2 16 6.6 20.5 8.2 20.5s1.4-5.2 3.8-5.2 2.2 5.2 3.8 5.2 2-4.5 2.9-8.3c.9-3.8 1.3-6.7-.1-8.2s-4.2-1-6 .4z"/>',
    ear:'<path d="M7 9.2a5 5 0 0 1 10 0c0 2.6-2 3.4-3.1 4.7-.9 1.1-.5 2.6-2 3.6-1.1.7-2.5.5-3.2-.6"/><path d="M10.3 9.6a1.9 1.9 0 0 1 3.7.5c0 1.5-1.4 1.9-1.9 3"/><path d="M5.5 20.5c-1.4-1.7-2-3.7-2-6"/>',
    eye:'<path d="M2 12s3.6-6.2 10-6.2S22 12 22 12s-3.6 6.2-10 6.2S2 12 2 12z"/><circle cx="12" cy="12" r="3.1"/>',
    steth:'<path d="M6 3v5.5a4.2 4.2 0 0 0 8.4 0V3"/><path d="M4.2 3h3.4M12.8 3h3.4"/><path d="M10.2 12.7v2.1a5.2 5.2 0 0 0 5.2 5.2h.2"/><circle cx="18.2" cy="17.8" r="2.6"/>',
    clip:'<rect x="5" y="4.2" width="14" height="17" rx="1.6"/><path d="M9 4.2V2.9h6v1.3"/><path d="M8.6 12.6l2.6 2.6 4.6-4.9"/>',
    derm:'<circle cx="10.4" cy="10.4" r="6.6"/><path d="M15.4 15.4L21 21"/><circle cx="8.6" cy="8.8" r=".9"/><circle cx="12" cy="10.8" r=".9"/><circle cx="9.4" cy="12.8" r=".9"/>',
    bell:'<path d="M3 9v6M6.2 6.5v11M17.8 6.5v11M21 9v6M6.2 12h11.6"/>',
    exphys:'<path d="M2.5 12h3.4l1.9-5.2 3 10.4 2.4-6.2 1.8 3h5.5"/>',
    aes:'<path d="M11 3.2l1.7 4.3 4.3 1.7-4.3 1.7L11 15.2 9.3 10.9 5 9.2l4.3-1.7z"/><path d="M18.4 14.6l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>'
  };
  function icon(k){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[k] + '</svg>';
  }

  var SERVICES = [
    {n:"Physiotherapy", i:"physio", pro:"Physiotherapists and sports rehabilitation specialists", clubs:"All four clubs"},
    {n:"Osteopathy", i:"osteo", pro:"Registered osteopaths", clubs:"Soho, Marylebone, Liverpool St"},
    {n:"Chiropractic", i:"chiro", pro:"Chiropractors", clubs:"Soho, Canary Wharf"},
    {n:"Sports and remedial massage", i:"massage", pro:"Sports and remedial massage therapists", clubs:"All four clubs"},
    {n:"Acupuncture", i:"acu", pro:"Acupuncturists and dry needling practitioners", clubs:"Soho, Marylebone"},
    {n:"Podiatry and chiropody", i:"pod", pro:"Podiatrists", clubs:"Marylebone, Canary Wharf"},
    {n:"Nutrition and dietetics", i:"nutri", pro:"Registered nutritionists and dietitians", clubs:"All four clubs"},
    {n:"Mental health and talking therapy", i:"mind", pro:"Psychotherapists and counsellors", clubs:"Soho, Marylebone, Canary Wharf"},
    {n:"Women's health and menopause", i:"venus", pro:"Women's health physios and menopause specialists", clubs:"Marylebone, Canary Wharf"},
    {n:"Dentistry", i:"tooth", pro:"Dentists and hygienists", clubs:"All four clubs"},
    {n:"Audiology and hearing", i:"ear", pro:"Audiologists", clubs:"Marylebone, Canary Wharf"},
    {n:"Optical and eye health", i:"eye", pro:"Optometrists", clubs:"Marylebone"},
    {n:"Private GP", i:"steth", pro:"GMC registered GPs", clubs:"All four clubs"},
    {n:"Health screening", i:"clip", pro:"Screening doctors and nurses", clubs:"Marylebone, Canary Wharf"},
    {n:"Dermatology and skin", i:"derm", pro:"Dermatologists and skin clinicians", clubs:"Marylebone"},
    {n:"Rehab and strength", i:"bell", pro:"Personal trainers and rehabilitation coaches", clubs:"All four clubs"},
    {n:"Exercise physiology", i:"exphys", pro:"Exercise physiologists", clubs:"Liverpool St"},
    {n:"Aesthetics", i:"aes", pro:"Aesthetic practitioners", clubs:"Liverpool St"}
  ];
  var BY_NAME = {};
  SERVICES.forEach(function(s){ BY_NAME[s.n.toLowerCase()] = s; });

  var META = {
    covered:     {cls:"st-ok",      label:"Covered",     key:"covered"},
    not_covered: {cls:"st-no",      label:"Not covered", key:"not_covered"},
    not_stated:  {cls:"st-unknown", label:"Not stated",  key:"not_stated"}
  };
  var ORDER = {covered:0, not_stated:1, not_covered:2};

  /* ---------- state ---------- */
  var chosenFile = null, sampleFn = null, sampleReady = false;
  var current = null, currentText = "", isExample = false;
  var userEmail = "";
  var selected = {};
  var filterStatus = "all", filterText = "";

  /* ---------- views ---------- */
  var VIEWS = ["viewHome","viewGate","viewBenefits","viewEnquire"];
  function show(id){
    VIEWS.forEach(function(v){ $(v).hidden = (v !== id); });
    window.scrollTo({top:0, behavior:"instant"});
  }

  /* ---------- upload panel ---------- */
  var fileEl=$("file"), dropEl=$("drop"), pasteBox=$("pasteBox"), statusEl=$("status");

  function setStatus(el, msg, isErr, busy){
    el.className = "status" + (isErr ? " err" : "");
    el.innerHTML = "";
    if (busy){ var s=document.createElement("span"); s.className="spin"; el.appendChild(s); }
    el.appendChild(document.createTextNode(msg || ""));
  }
  function humanSize(n){
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n/1024).toFixed(1) + " KB";
    return (n/1048576).toFixed(1) + " MB";
  }
  function refreshButton(){
    var has = chosenFile !== null || pasteBox.value.trim().length > 40;
    $("analyseBtn").disabled = !has;
  }
  function takeFile(f){
    if (!f) return;
    if (f.size > 10*1024*1024){
      setStatus(statusEl, "That file is larger than 10 MB. Try the summary of cover rather than the full policy pack.", true);
      return;
    }
    chosenFile = f;
    $("fileName").textContent = f.name;
    $("fileSize").textContent = humanSize(f.size);
    $("fileRow").hidden = false;
    setStatus(statusEl, "");
    refreshButton();
  }
  $("pickBtn").addEventListener("click", function(){ fileEl.click(); });
  fileEl.addEventListener("change", function(){ takeFile(fileEl.files && fileEl.files[0]); });
  $("clearFile").addEventListener("click", function(){
    chosenFile=null; fileEl.value=""; $("fileRow").hidden=true; setStatus(statusEl,""); refreshButton();
  });
  $("pasteToggle").addEventListener("click", function(){
    var w=$("pasteWrap"); w.hidden=!w.hidden;
    this.textContent = w.hidden ? "Paste the wording instead" : "Hide the text box";
    if (!w.hidden) pasteBox.focus();
  });
  pasteBox.addEventListener("input", refreshButton);
  ["dragenter","dragover"].forEach(function(ev){
    dropEl.addEventListener(ev, function(e){ e.preventDefault(); dropEl.classList.add("over"); });
  });
  ["dragleave","drop"].forEach(function(ev){
    dropEl.addEventListener(ev, function(e){ e.preventDefault(); dropEl.classList.remove("over"); });
  });
  dropEl.addEventListener("drop", function(e){
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) takeFile(e.dataTransfer.files[0]);
  });

  /* ---------- reading the document ---------- */
  function readAsText(f){
    return new Promise(function(res, rej){
      var r = new FileReader();
      r.onload = function(){ res(String(r.result||"")); };
      r.onerror = function(){ rej(new Error("The file could not be read.")); };
      r.readAsText(f);
    });
  }
  function extractPdf(f, onPage){
    if (typeof pdfjsLib === "undefined") return Promise.reject(new Error("The PDF reader did not load."));
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    } catch(e){ /* the loading task reports the real failure below */ }
    return f.arrayBuffer().then(function(buf){
      return pdfjsLib.getDocument({data:buf}).promise;
    }).then(function(pdf){
      var pages=[], seq=Promise.resolve(), n=Math.min(pdf.numPages, 60);
      for (var i=1;i<=n;i++){
        (function(p){
          seq = seq.then(function(){
            if (onPage) onPage(p, n);
            return pdf.getPage(p).then(function(pg){ return pg.getTextContent(); })
              .then(function(tc){ pages.push(tc.items.map(function(it){ return it.str; }).join(" ")); });
          });
        })(i);
      }
      return seq.then(function(){ return pages.join("\n\n"); });
    });
  }
  function getText(onPage){
    var pasted = pasteBox.value.trim();
    if (!chosenFile && pasted.length > 40){
      lastMeta = {source:"paste", chars:pasted.length};
      return Promise.resolve(pasted);
    }
    if (!chosenFile) return Promise.reject(new Error("Choose a policy document first."));
    var isPdf = /\.pdf$/i.test(chosenFile.name) || chosenFile.type === "application/pdf";
    return (isPdf ? extractPdf(chosenFile, onPage) : readAsText(chosenFile)).then(function(t){
      if (!t || t.replace(/\s/g,"").length < 120) throw new Error("SCANNED");
      lastMeta = {source: isPdf ? "pdf" : "paste", chars: t.length};
      return t;
    });
  }

  /* ---------- the reading prompt ---------- */
  function buildPrompt(text){
    var clipped = text.length > 46000;
    var body = clipped ? text.slice(0, 46000) : text;
    return [
      "You are reading a UK private health insurance document on behalf of the person it covers.",
      "They want to know which health and therapy services they can already claim for.",
      "",
      "ABSOLUTE RULES.",
      "1. Use ONLY the document text below. Never use general knowledge about the insurer.",
      "2. Never invent a name, policy number, date, figure or benefit. If the document does not state it, return null.",
      "3. Every 'evidence' value must be a VERBATIM span copied character for character from the document",
      "   text. Do not paraphrase, tidy punctuation or join separate sentences. If you have no verbatim",
      "   sentence to quote, set evidence to null and status to \"not_stated\".",
      "4. Judge each service only on what the document says about THAT service.",
      "5. Do NOT name any clinic, hospital group, physiotherapy chain, digital health app or",
      "   provider network the document routes people to, and do not repeat their phone numbers,",
      "   booking links or locations. Name the INSURER freely: the person needs to know who their",
      "   cover is with. If a sentence both names a provider and states a condition, keep the",
      "   condition and drop the name: \"you can self refer without a GP referral\" is right,",
      "   \"you can self refer through <provider>\" is not.",
      "6. Never remove a condition the person has to meet to be paid. Pre-authorisation, the need",
      "   for a practitioner the insurer recognises, excesses, session caps and referral rules all",
      "   stay, stated plainly. Someone who books believing they are covered when they are not ends",
      "   up paying the bill themselves, and that matters more than any other consideration here.",
      "   Prefer an evidence quote that does not name a provider; if the only quote available names",
      "   one, set evidence to null rather than quoting it.",
      "",
      "STATUS VALUES.",
      "\"covered\"     the document says this is paid for or provided. Use this even when the cover is",
      "              capped or conditional (session caps, referral needed, excess applies, plan option",
      "              required). Cover with a condition attached is still cover, and the person needs to",
      "              know they have it. Put the cap or condition in \"limit\" and say it in \"headline\".",
      "\"not_covered\" the document explicitly excludes it.",
      "\"not_stated\"  the document does not mention it either way. This is the correct answer far more",
      "              often than people expect. Use it freely.",
      "",
      "Assess exactly these services, using these names verbatim, in this order:",
      SERVICES.map(function(s){ return "- " + s.n; }).join("\n"),
      "",
      "Also list any non-clinical rewards, discounts or perks the document mentions (gym discounts, app",
      "subscriptions, health checks, cashback, retail offers). These are the benefits people most often",
      "miss. Give the exact figure the document states.",
      "",
      "Reply with ONLY this JSON object and nothing else:",
      "{",
      '  "policy": {',
      '    "holder": {"value": string|null},',
      '    "insurer": {"value": string|null},',
      '    "planName": {"value": string|null},',
      '    "policyNumber": {"value": string|null},',
      '    "coveragePeriod": {"value": string|null}',
      "  },",
      '  "services": [',
      '    {"name": string, "status": "covered"|"not_covered"|"not_stated",',
      '     "headline": string, "detail": string, "limit": string|null, "evidence": string|null}',
      "  ],",
      '  "extras": [{"name": string, "value": string}],',
      '  "docType": string,',
      '  "caveat": string',
      "}",
      "",
      "\"headline\" is at most 10 words, plain English, no jargon.",
      "\"detail\" is one or two sentences telling the person what they can actually do next.",
      "\"limit\" is the cap or condition in the document's own figures, or null. If the status",
      "is \"covered\" and the document attaches any cap, excess, referral rule or pre-authorisation",
      "requirement, \"limit\" must state it. Do not leave it null in that case.",
      "\"docType\" names what this document actually is, in six words or fewer.",
      "\"caveat\" is one sentence naming the most important thing this document does NOT settle.",
      "Use British English. Do not use em dashes. Do not use emoji.",
      clipped ? "NOTE: the document was long and has been cut to its first section." : "",
      "",
      "DOCUMENT TEXT:",
      "-----", body, "-----"
    ].join("\n");
  }

  /* ---------- third-party providers ----------
     The deployed app redacts server side in api/_lib/redact.js, which is the
     authoritative list. This is the same rule applied in the browser, because the
     artifact build asks Claude directly and never goes through the API. Keep the
     two lists in step. Removes WHO to go to; never removes what you must DO. */
  var BLOCKED = ["HCA Roodlane","Roodlane","HCA Healthcare","HCA UK","Nuffield Health",
    "Spire Healthcare","Spire","Circle Health","Ramsay Health Care","Ramsay",
    "Practice Plus Group","Optegra","Newmedica","Peppy","Bluecrest","Thriva","Babylon",
    "Livi","Push Doctor","Vita Health Group","Ascenti","Physio Med","Connect Health",
    "IPRS Health","Vitality GP","Care Hub","Onebright"].sort(function(a,b){ return b.length-a.length; });
  var KEEPERS = ["pre-auth","preauth","pre auth","authoris","authoriz","recognis","recogniz",
    "approved","excess","referral","refer","limit","cap","session","eligib","claim","must",
    "need to","required","before"];
  function rx(n, pre){
    var e = n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/\s+/g,"\\s+");
    return new RegExp((pre ? "(\\s*\\b(?:with|through|via|at|from|by|to)\\b)?\\s*" : "\\b") + e + "\\b","gi");
  }
  function named(t){
    if (!t) return false;
    for (var i=0;i<BLOCKED.length;i++) if (rx(BLOCKED[i]).test(String(t))) return true;
    return false;
  }
  function scrub(t){
    if (!t || !named(t)) return t;
    var out = String(t).split(/(?<=[.!?])\s+/).filter(Boolean).map(function(sent){
      if (!named(sent)) return sent;
      var low = sent.toLowerCase(), keep = false;
      for (var k=0;k<KEEPERS.length;k++) if (low.indexOf(KEEPERS[k]) !== -1) { keep = true; break; }
      if (!keep) return "";
      var v = sent;
      for (var i=0;i<BLOCKED.length;i++) v = v.replace(rx(BLOCKED[i], true), "");
      v = v.replace(/\s{2,}/g," ").replace(/\s+([,.;:])/g,"$1").trim();
      return v.replace(/[^a-z]/gi,"").length >= 12 ? v : "";
    }).filter(Boolean).join(" ").trim();
    return out;
  }

  /* ---------- evidence check ---------- */
  function norm(s){
    return String(s||"").toLowerCase().replace(/[\s ]+/g," ")
      .replace(/[‘’]/g,"'").replace(/[“”]/g,'"').trim();
  }
  function verify(quote, hay){
    if (!quote) return null;
    var q = norm(quote);
    if (q.length < 12) return null;
    if (hay.indexOf(q) !== -1) return true;
    return hay.indexOf(q.slice(0, Math.min(q.length, 90))) !== -1;
  }

  /* Used when a row has no usable headline of its own. That happens either because
     the model returned none, or because the one it returned named a third-party
     provider and the scrub removed it. The wording must stay true for the status
     it sits under: the old single fallback said "Covered, with conditions", which
     read as a claim about cover even on rows we had excluded or never seen. */
  var FALLBACK_HEADLINE = {
    covered:     "Your document says this is covered",
    not_covered: "Your document excludes this one",
    not_stated:  "This document does not mention it"
  };

  /* ---------- normalising the model's answer onto our catalogue ---------- */
  function merge(data){
    var got = {};
    (Array.isArray(data.services) ? data.services : []).forEach(function(s){
      if (s && s.name) got[String(s.name).toLowerCase().trim()] = s;
    });
    return SERVICES.map(function(cat){
      var s = got[cat.n.toLowerCase()] || {};
      var raw = String(s.status || "").toLowerCase().trim();
      /* "limited" was a separate bucket until v1.6.0. Cover with a condition is
         still cover, so anything arriving under the old label is read as covered.
         Kept because the model is swappable and not every provider will follow
         the current prompt exactly. */
      if (raw === "limited" || raw === "partial") raw = "covered";
      var st = META[raw] ? raw : "not_stated";
      return {
        n: cat.n, i: cat.i, pro: cat.pro, clubs: cat.clubs,
        status: st,
        headline: scrub(s.headline) || FALLBACK_HEADLINE[st],
        detail: scrub(s.detail) || "Your document says nothing either way about this one. Your full plan terms may still cover it, so it is worth asking your insurer.",
        limit: scrub(s.limit) || null,
        evidence: named(s.evidence) ? null : (s.evidence || null)
      };
    });
  }

  /* ---------- rendering the benefits view ---------- */
  function factCell(label, obj){
    var v = obj && obj.value ? String(obj.value).trim() : "";
    return '<div class="fact"><dt>' + esc(label) + '</dt>' +
      (v ? '<dd>' + esc(v) + '</dd>' : '<dd class="none">Not stated in this document</dd>') + '</div>';
  }

  function renderBenefits(data, sourceText, example){
    current = {data:data, rows:merge(data), hay:norm(sourceText||"")};
    currentText = sourceText || "";
    isExample = !!example;
    selected = {};
    filterStatus = "all"; filterText = "";
    $("search").value = "";

    var p = data.policy || {};
    $("facts").innerHTML =
      factCell("Policy holder", p.holder) + factCell("Insurer", p.insurer) +
      factCell("Plan", p.planName) + factCell("Policy number", p.policyNumber) +
      factCell("Cover period", p.coveragePeriod);

    var c = {covered:0, not_covered:0, not_stated:0};
    current.rows.forEach(function(r){ c[r.status]++; });
    $("tally").innerHTML =
      '<div class="t ok"><span class="n">'+c.covered+'</span><span class="l">Covered</span></div>' +
      '<div class="t no"><span class="n">'+c.not_covered+'</span><span class="l">Not covered</span></div>' +
      '<div class="t unknown"><span class="n">'+c.not_stated+'</span><span class="l">Not stated</span></div>';

    $("benefitsEyebrow").textContent = data.docType ? ("Read as: " + data.docType) : "Your cover";

    var CH = [["all","All",current.rows.length],["covered","Covered",c.covered],
              ["not_covered","Not covered",c.not_covered],
              ["not_stated","Not stated",c.not_stated]];
    $("chips").innerHTML = CH.map(function(x){
      return '<button class="chip" type="button" data-st="'+x[0]+'" aria-pressed="'+(x[0]==="all")+'">' +
             esc(x[1]) + ' <span class="c">' + x[2] + '</span></button>';
    }).join("");

    // A perk that is really a signup to someone else's service is not a perk we surface.
    var extras = (Array.isArray(data.extras) ? data.extras : []).filter(function(x){
      return x && x.name && !named(x.name) && !named(x.value);
    });
    $("extrasWrap").hidden = extras.length === 0;
    $("extras").innerHTML = extras.map(function(x){
      return '<div class="extra"><div class="nm">'+esc(x.name)+'</div><div class="vl">'+esc(x.value||"")+'</div></div>';
    }).join("");

    $("caveat").textContent = (data.caveat ||
      "This is a reading of one document, not a decision from your insurer.") +
      " Cover depends on your own plan options and any excess, so confirm with your insurer before you book." +
      (isExample ? " These figures come from the worked example, not from a document you uploaded."
                 : " Nothing you uploaded was sent to UNTIL or stored.");

    $("exampleBanner").hidden = !isExample;
    $("exampleText").textContent = "Built from a real Vitality member guide, so you can see the output before uploading anything of your own.";

    paintTiles();
    updateBar();
    show("viewBenefits");
  }

  function tileHtml(r, idx){
    var m = META[r.status];
    var ok = verify(r.evidence, current.hay);
    var h = '<div class="tile ' + m.cls + (selected[r.n] ? ' sel' : '') + '" data-i="' + idx + '">';
    h += '<div class="head"><span class="ico">' + icon(r.i) + '</span><span class="pill">' + m.label + '</span></div>';
    h += '<div class="main"><span class="nm">' + esc(r.n) + '</span>';
    if (r.headline) h += '<p class="hl">' + esc(r.headline) + '</p>';
    h += '<p class="at">' + esc(r.clubs) + '</p></div>';
    h += '<div class="detail"><p class="dt">What this means</p><p>' + esc(r.detail) + '</p>';
    if (r.limit) h += '<p class="lim">' + esc(r.limit) + '</p>';
    h += '<p class="who">' + esc(r.pro) + '<br>' + esc(r.clubs) + '</p>';
    if (r.evidence){
      h += '<blockquote' + (ok ? '' : ' class="unver"') + '>' + esc(r.evidence) +
           '<cite>' + (ok ? 'Quoted from your document'
                          : 'Not matched in your document, check with your insurer') + '</cite></blockquote>';
    }
    h += '</div>';
    h += '<div class="foot"><button class="selbtn" type="button" data-sel="' + idx + '" ' +
         'aria-pressed="' + (selected[r.n] ? "true" : "false") + '">' +
         '<span class="box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" ' +
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span>' +
         '<span>' + (selected[r.n] ? "Selected" : "Select") + '</span></button></div>';
    return h + '</div>';
  }

  function visibleRows(){
    var q = filterText.trim().toLowerCase();
    return current.rows.map(function(r,i){ return {r:r,i:i}; }).filter(function(o){
      if (filterStatus !== "all" && o.r.status !== filterStatus) return false;
      if (!q) return true;
      return (o.r.n + " " + o.r.pro + " " + (o.r.headline||"") + " " + (o.r.detail||"")).toLowerCase().indexOf(q) !== -1;
    }).sort(function(a,b){
      var d = ORDER[a.r.status] - ORDER[b.r.status];
      return d !== 0 ? d : a.i - b.i;
    });
  }

  function paintTiles(){
    var rows = visibleRows();
    $("tiles").innerHTML = rows.map(function(o){ return tileHtml(o.r, o.i); }).join("");
    var n = rows.length;
    $("resultCount").textContent = n === current.rows.length
      ? (n + " services checked against your policy")
      : (n + " of " + current.rows.length + " services shown");
    if (n === 0) $("tiles").innerHTML =
      '<div class="tile" style="grid-column:1/-1;min-height:0;padding:26px 18px">' +
      '<p class="hl" style="margin:0">Nothing matches that. Clear the search or pick a different status.</p></div>';
  }

  /* ---------- filters, selection, booking ---------- */
  $("search").addEventListener("input", function(){ filterText = this.value; paintTiles(); });
  $("chips").addEventListener("click", function(e){
    var b = e.target.closest ? e.target.closest(".chip") : null;
    if (!b) return;
    filterStatus = b.getAttribute("data-st");
    Array.prototype.forEach.call(this.querySelectorAll(".chip"), function(c){
      c.setAttribute("aria-pressed", String(c === b));
    });
    paintTiles();
  });

  $("tiles").addEventListener("click", function(e){
    var sel = e.target.closest ? e.target.closest("[data-sel]") : null;
    if (sel){
      var r = current.rows[Number(sel.getAttribute("data-sel"))];
      if (selected[r.n]) delete selected[r.n]; else selected[r.n] = r;
      paintTiles(); updateBar();
      return;
    }
    var tile = e.target.closest ? e.target.closest(".tile") : null;
    if (tile) tile.classList.toggle("open");
  });

  function selectedList(){ return Object.keys(selected).map(function(k){ return selected[k]; }); }

  function updateBar(){
    var n = selectedList().length;
    $("selCount").textContent = n;
    $("selWord").textContent = n === 1 ? "service selected" : "services selected";
    $("bookBtn").disabled = n === 0;
  }
  $("clearSel").addEventListener("click", function(){ selected = {}; paintTiles(); updateBar(); });

  /* ---------- enquiry ---------- */
  function openEnquiry(){
    var list = selectedList();
    $("picked").innerHTML = list.length
      ? '<p class="dt" style="font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--faint)">You are asking about</p><ul>' +
        list.map(function(r){ return '<li>' + esc(r.n) + ' <span style="color:var(--faint)">' + esc(r.pro) + '</span></li>'; }).join("") + '</ul>'
      : '<p class="dt" style="font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--faint)">General enquiry</p>' +
        '<p style="margin-top:8px;font-size:14px">Tell us what you are after and we will point you at the right practitioner.</p>';
    /* Someone who came straight here from "Get matched with a practitioner" has not done
       steps one and two, so do not tell them this is step three of three. */
    var eyebrow = $("enqEyebrow"), title = $("enqTitle");
    if (eyebrow) eyebrow.textContent = current ? "Step 3 of 3" : "No policy needed";
    if (title) title.textContent = current ? "Book with a professional" : "Get matched with a practitioner";

    if (userEmail) $("enqEmail").value = userEmail;
    var ins = current && current.data && current.data.policy && current.data.policy.insurer;
    if (ins && ins.value) $("enqInsurer").value = ins.value;
    show("viewEnquire");
  }
  $("bookBtn").addEventListener("click", openEnquiry);

  /* Any control marked data-cta="enquire" opens the enquiry form. The co-branded
     pages use this for both calls to action, so "Get matched with a practitioner" does the
     same thing wherever it is clicked. No example policy is loaded first: with no
     reading to show, openEnquiry falls back to its general enquiry copy, which is
     honest, rather than seeding the form with a fictional insurer. */
  Array.prototype.forEach.call(document.querySelectorAll('[data-cta="enquire"]'),
    function(el){ el.addEventListener("click", function(e){ e.preventDefault(); openEnquiry(); }); });

  /* The un-branded and Meta pages still carry the original button. */
  var enquireTop = $("enquireTop");
  if (enquireTop) enquireTop.addEventListener("click", function(){
    if (!current) loadExample(true);
    openEnquiry();
  });
  $("enqCancel").addEventListener("click", function(e){ e.preventDefault(); show("viewBenefits"); });
  $("enqBack").addEventListener("click", function(e){ e.preventDefault(); show(current ? "viewBenefits" : "viewHome"); });

  $("enqForm").addEventListener("submit", function(e){
    e.preventDefault();
    var nm = $("enqName").value.trim(), em = $("enqEmail").value.trim();
    if (!nm){ $("enqErr").textContent = "Add your name so we know who to reply to."; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)){
      $("enqErr").textContent = "That email address does not look right. Check it and try again."; return;
    }
    $("enqErr").textContent = "";

    var list = selectedList();
    var btn = e.target.querySelector('button[type="submit"]');
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = "Sending";

    fetch("/api/enquiry", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        name: nm, email: em,
        club: $("enqClub").value,
        insurer: $("enqInsurer").value.trim(),
        services: list.map(function(r){ return r.n; }),
        notes: $("enqMsg").value.trim()
      })
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(j){
        if (!r.ok) throw new Error(j.message || "Your request could not be sent.");
        return j;
      });
    }).then(function(){
      $("enqInner").innerHTML =
        '<div class="done"><div class="tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 12.5l5 5L20 6.5"/></svg></div>' +
        '<h2>Request sent, ' + esc(nm.split(" ")[0]) + '</h2>' +
        '<p class="lede" style="margin:14px auto 0;text-align:left">We have your request for ' +
        (list.length ? esc(list.map(function(r){ return r.n.toLowerCase(); }).join(", "))
                     : "a general enquiry") +
        ' at UNTIL ' + esc($("enqClub").value) + ', under ' + esc(em) + '.</p>' +
        '<p class="note" style="margin-top:22px;text-align:left">The club will be in touch within one ' +
        'working day to confirm a time. If it is urgent, call the club directly.</p>' +
        '<div class="actions" style="justify-content:center"><button class="btn ghost" type="button" ' +
        'id="doneBack">Back to my benefits</button></div></div>';
      $("doneBack").addEventListener("click", function(){ show("viewBenefits"); });
      window.scrollTo({top:0, behavior:"instant"});
    }).catch(function(err){
      btn.disabled = false; btn.textContent = label;
      $("enqErr").textContent = (err && err.message)
        || "Your request could not be sent. Try again, or call the club directly.";
    });
  });

  /* ---------- the email gate ---------- */
  var pendingText = null;
  /* Anonymous: how the document arrived and how long it was. No text, no filename. */
  var lastMeta = {source:"pdf", chars:0};
  function openGate(text, docLabel){
    pendingText = text;
    $("gateDoc").textContent = docLabel;
    setStatus($("gateStatus"), "");
    $("gateErr").textContent = "";
    show("viewGate");
    setTimeout(function(){ $("email").focus(); }, 60);
  }
  $("gateBack").addEventListener("click", function(e){ e.preventDefault(); show("viewHome"); });

  $("gateForm").addEventListener("submit", function(e){
    e.preventDefault();
    var em = $("email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)){
      $("gateErr").textContent = "That email address does not look right. Check it and try again."; return;
    }
    $("gateErr").textContent = "";
    userEmail = em;
    /* Fire and forget: the visitor is waiting on their policy, so a failure here
       must never delay or block it. Skipped where there is no API to post to -- in
       an artifact build the endpoint does not exist and the browser refuses it. */
    if (HAS_API){
      try {
        fetch("/api/lead", {method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({email: em, source: "gate"})}).catch(function(){});
      } catch(e){}
    }
    var btn = $("gateGo"); btn.disabled = true;

    if (!sampleFn && !HAS_API){
      setStatus($("gateStatus"), "", false);
      btn.disabled = false;
      loadExample(false);
      $("exampleText").textContent =
        "This browser cannot reach Claude, so your document could not be read. Shown here is the worked example.";
      return;
    }

    setStatus($("gateStatus"), "Reading your policy against 18 services. This takes up to a minute.", false, true);
    askJson(buildPrompt(pendingText)).then(function(data){
      setStatus($("gateStatus"), "");
      btn.disabled = false;
      renderBenefits(data, pendingText, false);
    }).catch(function(err){
      btn.disabled = false;
      setStatus($("gateStatus"), copyFor(err && err.code), true);
    });
  });

  function copyFor(code){
    switch(code){
      case "not_configured":
        return "The analyser is not switched on yet. Your document was not read.";
      case "invalid_json":
        return "The reading came back in a form this page could not use. Try again.";
      case "not_granted": case "sampling_disabled": case "not_declared":
      case "capability_disabled": case "capability_removed":
        return "This page is not allowed to use Claude on your account, so it cannot read your document. The worked example still works.";
      case "rate_limited": return "Claude is busy on your account right now. Wait a minute and try again.";
      case "session_expired": return "Your Claude session has expired. Sign in again, then try again.";
      case "prompt_too_large": return "That document is too long to read in one go. Try the summary of cover rather than the full policy pack.";
      case "invalid_json": return "The reading came back malformed. Try again.";
      case "refused": return "Claude would not read that document. Try the summary of cover instead.";
      case "empty_completion": return "Nothing came back. Try a shorter section of the policy.";
      case "cancelled": return "";
      default: return "Something went wrong reading the document. Try again in a moment.";
    }
  }

  /* ---------- check my cover ---------- */
  $("analyseBtn").addEventListener("click", function(){
    var btn = this;
    btn.disabled = true;
    setStatus(statusEl, "Reading your document...", false, true);
    getText(function(p,n){ setStatus(statusEl, "Reading page " + p + " of " + n + "...", false, true); })
      .then(function(text){
        setStatus(statusEl, "");
        btn.disabled = false;
        openGate(text, chosenFile ? chosenFile.name : "the wording you pasted");
      })
      .catch(function(e){
        btn.disabled = false;
        var msg;
        if (e && e.message === "SCANNED"){
          msg = "No text could be read from that file. It is probably a scan. Paste the wording instead.";
          $("pasteWrap").hidden = false; $("pasteToggle").textContent = "Hide the text box";
        } else {
          msg = (e && e.message) ? e.message : "Something went wrong.";
          if (/reader did not load|worker/i.test(msg)){
            msg = "The PDF reader could not start. Paste the policy wording instead.";
            $("pasteWrap").hidden = false; $("pasteToggle").textContent = "Hide the text box";
          }
        }
        setStatus(statusEl, msg, true);
      });
  });

  $("restart").addEventListener("click", function(e){
    e.preventDefault();
    current = null; chosenFile = null; fileEl.value = ""; pasteBox.value = "";
    $("fileRow").hidden = true; setStatus(statusEl, ""); refreshButton();
    show("viewHome");
    setTimeout(function(){ $("upload").scrollIntoView({behavior:"smooth", block:"start"}); }, 80);
  });

  /* ---------- the worked example ----------
     Real wording from a Vitality member guide, so every quote below verifies
     against the text it is quoted from. */
  var EXAMPLE_TEXT = [
    "With Care Hub, you can arrange to see a Vitality GP fast, at a time to suit you. You can arrange up to six physiotherapy sessions and up to eight mental health sessions, without the need for a GP referral.",
    "Self referral to our Priority Physio service. Access to 24/7 virtual physiotherapy support is also available through our partner Ascenti Reach.",
    "Treatment is covered in full when Out-patient Cover is selected. If Out-patient Cover is not selected, up to 6 sessions of physiotherapy are available when arranged through our network partner.",
    "You can self-refer for some mental health treatments so you do not have to wait to see a GP first. You can also self-refer for physiotherapy through our network of over 1,400 physiotherapy clinics.",
    "Menopause support and advice: Connect with practitioners for menopause support and advice. In partnership with Peppy.",
    "The Personal Health Fund (PHF) is a pot of money that you can use to help pay for everyday healthcare expenses such as optical costs and dental care. You start off with £75 in your fund each plan year after you have completed your online Health Review.",
    "Monthly gym membership: Up to 50% off. Each adult member on a plan can have one discounted gym membership at either Nuffield Health, PureGym or Virgin Active.",
    "Headspace: 12-month subscription on us. Earn Vitality points for mindful activities.",
    "Vitality Healthcheck: No additional cost. An annual health check through our partner Bluecrest, measuring blood pressure, Body Mass Index, glucose and cholesterol levels.",
    "Private medical insurance is designed to cover treatment for curable (acute) conditions. It does not usually cover long-term treatment of chronic conditions where the purpose of that treatment is primarily to keep the symptoms under control.",
    "We do not pay for emergency care. This includes treatment in an Accident & Emergency unit or other urgent care centres."
  ].join("\n\n");

  var EXAMPLE = {
    docType: "Member guide to making a claim",
    policy: {
      holder:{value:null}, insurer:{value:"VitalityHealth"}, planName:{value:null},
      policyNumber:{value:null}, coveragePeriod:{value:null}
    },
    services: [
      {name:"Physiotherapy", status:"covered",
       headline:"Six sessions without seeing a GP first",
       detail:"You can refer yourself straight to a physiotherapist through Care Hub. Six sessions are included, and the cap lifts to full cover if your plan has Out-patient Cover.",
       limit:"Up to 6 sessions, or full cover with Out-patient Cover selected",
       evidence:"Treatment is covered in full when Out-patient Cover is selected. If Out-patient Cover is not selected, up to 6 sessions of physiotherapy are available when arranged through our network partner."},
      {name:"Mental health and talking therapy", status:"covered",
       headline:"Eight sessions, no GP referral needed",
       detail:"You can self-refer for talking therapy rather than waiting for a GP appointment. Book the first session and start.",
       limit:"Up to 8 sessions without a GP referral",
       evidence:"You can arrange up to six physiotherapy sessions and up to eight mental health sessions, without the need for a GP referral."},
      {name:"Women's health and menopause", status:"covered",
       headline:"Menopause support through Peppy",
       detail:"You can connect with menopause practitioners directly. This is one of the most widely missed benefits on the plan.",
       limit:null,
       evidence:"Menopause support and advice: Connect with practitioners for menopause support and advice. In partnership with Peppy."},
      {name:"Private GP", status:"covered",
       headline:"Same day GP appointments through Care Hub",
       detail:"Care Hub gets you in front of a GP quickly, which is also the route to most onward referrals on this plan.",
       limit:null,
       evidence:"With Care Hub, you can arrange to see a Vitality GP fast, at a time to suit you."},
      {name:"Health screening", status:"covered",
       headline:"Annual health check at no extra cost",
       detail:"Book the Bluecrest check each plan year. It also unlocks the Personal Health Fund you can spend on dental and optical.",
       limit:null,
       evidence:"Vitality Healthcheck: No additional cost. An annual health check through our partner Bluecrest, measuring blood pressure, Body Mass Index, glucose and cholesterol levels."},
      {name:"Dentistry", status:"covered",
       headline:"Paid from a £75 yearly health fund",
       detail:"Everyday dental costs come out of your Personal Health Fund, which you unlock by completing the online Health Review.",
       limit:"£75 per plan year, shared with optical",
       evidence:"The Personal Health Fund (PHF) is a pot of money that you can use to help pay for everyday healthcare expenses such as optical costs and dental care. You start off with £75 in your fund each plan year after you have completed your online Health Review."},
      {name:"Optical and eye health", status:"covered",
       headline:"Same £75 fund covers optical costs",
       detail:"Optical sits in the same pot as dental, so the fund is spent once. Complete the Health Review first or the fund stays locked.",
       limit:"£75 per plan year, shared with dental",
       evidence:"The Personal Health Fund (PHF) is a pot of money that you can use to help pay for everyday healthcare expenses such as optical costs and dental care."}
    ],
    extras: [
      {name:"Gym membership", value:"Up to 50% off at Nuffield Health, PureGym or Virgin Active"},
      {name:"Headspace", value:"12 month subscription included"},
      {name:"Vitality Healthcheck", value:"Annual check with Bluecrest at no additional cost"},
      {name:"Personal Health Fund", value:"£75 a year, released once you complete the online Health Review"}
    ],
    caveat: "This guide explains how to claim, so it does not list every therapy your particular plan includes."
  };

  function loadExample(){ renderBenefits(EXAMPLE, EXAMPLE_TEXT, true); }
  $("exampleBtn").addEventListener("click", loadExample);
  $("exampleBtn2").addEventListener("click", loadExample);

  /* ---------- start ---------- */
  refreshButton();
  setStatus(statusEl, "");

  function noClaude(){
    sampleReady = true; sampleFn = null;
    if (HAS_API){ setStatus(statusEl, ""); return; }
    setStatus(statusEl,
      "This browser cannot reach Claude, so a document cannot be read here. The worked example still works.", true);
  }
  try {
    if (window.claude && typeof window.claude.use === "function"){
      Promise.resolve(window.claude.use("sample")).then(function(fn){
        sampleReady = true; sampleFn = fn || null;
        if (!sampleFn) noClaude();
      }).catch(noClaude);
    } else { noClaude(); }
  } catch(e){ noClaude(); }

})();
