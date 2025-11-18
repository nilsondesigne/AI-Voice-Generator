/* ============================
   CONFIGURAÇÃO — Cole suas chaves
   ============================ */
const TTS_API_KEY    = "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";      // Text-to-Speech clássico (GET /v1/voices & POST /v1/text:synthesize)
const GEMINI_API_KEY = "AIzaSyCFkpqAtnr_ScFxJp43y2N6oF_XCJpnvk8";   // Gemini generativelanguage (generateContent)
const VOICES_URL     = `https://texttospeech.googleapis.com/v1/voices?key=${TTS_API_KEY}`;
const TTS_SYNTH_URL  = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_API_KEY}`;
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

/* ============================
   Catálogo básico Gemini (exemplo)
   - Gemini não fornece um endpoint público para 'listar vozes' idêntico ao TTS,
     então usamos um catálogo manual adaptável.
   - Você pode editar/expandir este array com nomes/idiomas que sua conta suportar.
   ============================ */
const GEMINI_CATALOG = [
  { id: "gemini_en_julia", name: "Julia (EN)", language: "en-US", desc: "Gemini Studio - natural" },
  { id: "gemini_en_oliver", name: "Oliver (EN)", language: "en-US", desc: "Gemini Studio - natural" },
  { id: "gemini_pt_julia", name: "Julia (PT-BR)", language: "pt-BR", desc: "Gemini Studio - PT-BR (se disponível)" },
  // adicione mais conforme sua conta
];

/* ============================
   DOM refs
   ============================ */
const engineSelect = document.getElementById("engineSelect");
const voiceSelect  = document.getElementById("voice");
const voiceSearch  = document.getElementById("voiceSearch");
const speedRange   = document.getElementById("speed");
const rateVal      = document.getElementById("rateVal");
const textInput    = document.getElementById("text");
const previewBtn   = document.getElementById("previewBtn");
const synthBtn     = document.getElementById("synthesizeBtn");
const player       = document.getElementById("player");
const genderFilter = document.getElementById("gender");

/* ============================
   Estado local
   ============================ */
let ttsVoices = [];   // vozes obtidas do TTS clássico
let combinedVoices = []; // vozes atuais mostradas no select
let currentEngine = engineSelect.value;

/* ============================
   Helpers
   ============================ */
function base64ToBlob(base64, mime = "audio/mp3") {
  const bytes = atob(base64);
  const len = bytes.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = bytes.charCodeAt(i);
  return new Blob([out], { type: mime });
}

function setPlayerBlobUrl(blob) {
  const url = URL.createObjectURL(blob);
  player.src = url;
  player.style.display = "block";
  return url;
}

/* ============================
   Carregar vozes TTS clássico via API
   ============================ */
async function fetchTtsVoices() {
  try {
    const res = await fetch(VOICES_URL);
    const json = await res.json();
    ttsVoices = (json.voices || []).map(v => {
      // inferir tipo pela convenção do nome (WaveNet, Neural2, etc)
      const type = (v.name || "").toLowerCase().includes("wavenet") ? "WaveNet" :
                   (v.name || "").toLowerCase().includes("neural") ? "Neural" : "Standard";
      return {
        id: v.name,
        name: v.name,
        languageCodes: v.languageCodes || [],
        gender: v.ssmlGender || "",
        type,
        raw: v
      };
    });
    console.log("TTS voices loaded:", ttsVoices.length);
  } catch (err) {
    console.error("Erro ao obter vozes TTS:", err);
    ttsVoices = [];
  }
}

/* ============================
   Montar lista de vozes (segundo engine)
   ============================ */
function buildVoiceList() {
  currentEngine = engineSelect.value;
  let list = [];
  if (currentEngine === "tts") {
    list = ttsVoices.map(v => ({
      value: v.id,
      label: `${v.name} — ${v.languageCodes.join(", ")} — ${v.type} ${v.gender ? "— " + v.gender : ""}`,
      meta: v
    }));
  } else {
    // Gemini
    list = GEMINI_CATALOG.map(v => ({
      value: v.id,
      label: `${v.name} — ${v.language} — ${v.desc}`,
      meta: v
    }));
  }
  combinedVoices = list;
  renderVoiceOptions(list);
}

/* ============================
   Renderizar options no select
   ============================ */
function renderVoiceOptions(list) {
  voiceSelect.innerHTML = "";
  if (!list.length) {
    voiceSelect.innerHTML = `<option>Nenhuma voz disponível</option>`;
    return;
  }
  list.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.value;
    opt.textContent = item.label;
    voiceSelect.appendChild(opt);
  });
}

/* ============================
   Filtrar vozes via search + gender
   ============================ */
function applyFilter() {
  const q = (voiceSearch.value || "").toLowerCase().trim();
  const gender = (genderFilter.value || "").toUpperCase();
  const filtered = combinedVoices.filter(v => {
    const label = v.label.toLowerCase();
    const genderOk = !gender || (v.meta.gender && v.meta.gender.toUpperCase() === gender) || (v.meta?.desc && v.meta.desc.toUpperCase().includes(gender));
    return (q === "" || label.includes(q)) && genderOk;
  });
  renderVoiceOptions(filtered);
}

/* ============================
   Preview: gera um áudio curto (não baixa)
   ============================ */
async function previewVoice() {
  const selected = voiceSelect.value;
  if (!selected) return alert("Escolha uma voz primeiro.");
  const sampleText = "Este é um teste rápido da voz selecionada.";

  if (currentEngine === "tts") {
    // TTS clássico — text:synthesize
    const payload = {
      input: { text: sampleText },
      voice: { name: selected },
      audioConfig: { audioEncoding: "MP3", speakingRate: parseFloat(speedRange.value || 1.0) }
    };
    try {
      const r = await fetch(TTS_SYNTH_URL, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (!j.audioContent) throw new Error("Sem audioContent");
      const blob = base64ToBlob(j.audioContent, "audio/mp3");
      setPlayerBlobUrl(blob);
    } catch (err) {
      console.error(err); alert("Erro no preview TTS. Veja console.");
    }
  } else {
    // Gemini preview — usar generateContent com prompt curto
    // Nota: a forma de enviar som pode variar por versão; aqui assumimos resposta base64 em candidates[0].audio
    const voiceMeta = GEMINI_CATALOG.find(v => v.id === selected);
    const payload = {
      // estrutura adaptada conforme exemplo do endpoint generativelanguage generateContent
      // request simplificado: prompt em SSML via parts.text
      contents: [{
        parts: [{ text: `<speak><prosody rate="${speedRange.value}">${sampleText}</prosody></speak>` }]
      }],
      generationConfig: {
        voiceConfig: { voiceName: voiceMeta ? voiceMeta.name : selected }
      }
    };
    try {
      const r = await fetch(GEMINI_URL, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const j = await r.json();
      const audioB64 = j?.candidates?.[0]?.audio;
      if (!audioB64) throw new Error("Sem audio em resposta Gemini");
      const blob = base64ToBlob(audioB64, "audio/mp3");
      setPlayerBlobUrl(blob);
    } catch (err) {
      console.error(err); alert("Erro no preview Gemini. Veja console.");
    }
  }
}

/* ============================
   Síntese final (gera e baixa)
   ============================ */
async function synthesizeAndDownload() {
  const text = (textInput.value || "").trim();
  if (!text) return alert("Digite um texto para sintetizar.");
  const voiceId = voiceSelect.value;
  if (!voiceId) return alert("Escolha uma voz.");

  const speed = parseFloat(speedRange.value || 1.0);

  if (currentEngine === "tts") {
    const payload = { input: { text }, voice: { name: voiceId }, audioConfig: { audioEncoding: "MP3", speakingRate: speed } };
    try {
      const r = await fetch(TTS_SYNTH_URL, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (!j.audioContent) throw new Error("Sem audioContent");
      const blob = base64ToBlob(j.audioContent, "audio/mp3");
      // baixar
      const url = setPlayerBlobUrl(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `tts-${voiceId}.mp3`; document.body.appendChild(a); a.click(); a.remove();
    } catch (err) {
      console.error(err); alert("Erro ao gerar TTS. Veja console.");
    }
  } else {
    // Gemini final generate
    const voiceMeta = GEMINI_CATALOG.find(v => v.id === voiceId);
    const payload = {
      contents: [{ parts: [{ text: `<speak><prosody rate="${speed}">${text}</prosody></speak>` }] }],
      generationConfig: { voiceConfig: { voiceName: voiceMeta ? voiceMeta.name : voiceId } }
    };
    try {
      const r = await fetch(GEMINI_URL, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const j = await r.json();
      const audioB64 = j?.candidates?.[0]?.audio;
      if (!audioB64) throw new Error("Sem audio da Gemini");
      const blob = base64ToBlob(audioB64, "audio/mp3");
      const url = setPlayerBlobUrl(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `gemini-${voiceId}.mp3`; document.body.appendChild(a); a.click(); a.remove();
    } catch (err) {
      console.error(err); alert("Erro ao gerar Gemini. Veja console.");
    }
  }
}

/* ============================
   Eventos
   ============================ */
engineSelect.addEventListener("change", async () => {
  currentEngine = engineSelect.value;
  if (currentEngine === "tts" && ttsVoices.length === 0) {
    await fetchTtsVoices();
  }
  buildVoiceList();
});

voiceSearch.addEventListener("input", applyFilter);
genderFilter.addEventListener("change", applyFilter);
speedRange.addEventListener("input", () => { rateVal.textContent = parseFloat(speedRange.value).toFixed(2); });

previewBtn.addEventListener("click", previewVoice);
synthBtn.addEventListener("click", synthesizeAndDownload);

/* ============================
   Inicialização
   ============================ */
(async function init(){
  // carregar vozes TTS logo de início (se a chave estiver configurada)
  if (TTS_API_KEY && TTS_API_KEY.length > 5) {
    await fetchTtsVoices();
  } else {
    console.warn("TTS_API_KEY não configurada - carregamento de vozes TTS ignorado.");
  }
  // combinar e montar a lista inicial (gemini catalog + tts se disponível)
  buildVoiceList();
})();
