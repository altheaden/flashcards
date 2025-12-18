"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClozeCardType = exports.SimpleCardType = exports.FlashcardType = exports.gCardTypeRegistry = void 0;
exports.registerFlashcardType = registerFlashcardType;
const utils_1 = require("utils/utils");
const editor_1 = require("core/editor");
const random_templating_1 = require("utils/random-templating");
const generic_preloader_1 = require("utils/generic-preloader");
const speech_1 = require("utils/speech");
const flashcard_1 = require("core/flashcard");
const nunjucks_1 = require("nunjucks");
const nj_templates_1 = require("utils/nj-templates");
exports.gCardTypeRegistry = {};
class FlashcardType {
    getTypeName() {
        throw new Error("getTypeName not implemented!");
    }
    getUserFriendlyName() {
        throw new Error("getUserFriendlyName not implemented!");
    }
    getMaybeSetting(key, settings) {
        if (key in settings) {
            return settings[key];
        }
        else {
            return null;
        }
    }
    speakCard(data, settings, resolve) {
        var ss = this.getMaybeSetting("speechSettings", settings);
        if (ss == null) {
            console.log("SPEECH SETTINGS NOT FOUND");
            resolve();
        }
        else {
            (0, speech_1.utter)(this.getSpeakableText(data), ss.voice, ss.rate, ss.pitch, resolve);
        }
    }
}
exports.FlashcardType = FlashcardType;
function registerFlashcardType(ft) {
    exports.gCardTypeRegistry[ft.getTypeName()] = ft;
}
class SimpleCardType extends FlashcardType {
    getTypeName() {
        return "simple-card";
    }
    getUserFriendlyName() {
        return "Simple two-sided flashcards";
    }
    // abstract preprocessEntry(entry: E, settings: S): void;
    preprocessEntry(entry, settings) {
        return;
    }
    // abstract processEntry(entry: E, settings: S, context: any): Promise<D>;
    processEntry(entry, settings, context) {
        var preventReversedCard = context.preventReversedCard;
        var canBeReversed = !preventReversedCard && entry.twoSided && settings.doTwoSided;
        var reversed = canBeReversed && (Math.random() < settings.probReversed);
        var canBeSpoken = settings.doReadAloud && entry.readAloud;
        var spoken = reversed && canBeSpoken && (Math.random() < settings.probSpoken);
        var subber = (0, utils_1.makeSubber)(settings.substitutions);
        var tpPrompt = [];
        var tpAnswers = [];
        var ctx = {};
        for (var i in Object.keys(entry.prompt)) {
            var res = (0, random_templating_1.randomizeStringSub)(subber(entry.prompt[i]), ctx);
            ctx = res[1];
            tpPrompt.push(res[0]);
        }
        for (var i in Object.keys(entry.answer)) {
            var res = (0, random_templating_1.randomizeStringSub)(subber(entry.answer[i]), ctx);
            ctx = res[1];
            tpAnswers.push(res[0]);
        }
        return (0, utils_1.trivialPromise)({
            prompt: reversed ? tpAnswers : tpPrompt,
            answer: reversed ? tpPrompt : tpAnswers,
            reversed: reversed,
            spoken: spoken
        });
    }
    // abstract getSearchableText(entry: E): string;
    getSearchableText(entry) {
        return entry.prompt.join(" ").concat(entry.answer.join(" "));
    }
    // abstract getSpeakableText(data: D): string;
    getSpeakableText(data) {
        if (data.reversed)
            return data.prompt[0];
        else
            return data.answer[0];
    }
    // abstract generateCard(data: D, settings: S, externalParams: IDictionary<any>): Flashcard;
    generateCard(data, settings, externalParams = {}) {
        var a = document.createElement("div");
        var prompt = "";
        var answers = [];
        var hint = "";
        prompt = data.prompt[0];
        answers = data.answer;
        hint = data.answer.join(' | ');
        var fontSize = 100.0 / (10.0 * Math.log(10 + prompt.length));
        var templateArgs = {
            prompts: data.prompt,
            fontSize: fontSize,
            reversed: data.reversed,
            spoken: data.spoken
        };
        templateArgs = Object.assign({}, templateArgs, externalParams);
        var tpl = settings.template;
        var el = (new DOMParser().parseFromString((0, nunjucks_1.renderString)(tpl, templateArgs), "text/html").body.firstChild);
        el = (0, speech_1.makeAudioButtons)(el, settings.speechSettings);
        return new flashcard_1.Flashcard(el, hint);
    }
    // abstract checkAnswer(answer: string, data: D, settings: S): Promise<boolean>;
    checkAnswer(answer, data, settings, tf) {
        return (0, utils_1.trivialPromise)(data.answer.map(tf).includes(tf(answer)));
    }
    // abstract makeEntryEditor(entry: E): StateEditor<E>;
    makeEntryEditor(entry) {
        var edDetails = document.createElement("details");
        var edSummary = document.createElement("summary");
        edDetails.style.display = "inline-block";
        edDetails.appendChild(edSummary);
        edDetails.classList.add("cardlist-accordion");
        edDetails.onkeyup = function (e) {
            if (e.keyCode == 32) {
                e.preventDefault();
            }
        };
        var edMain = (0, editor_1.swappingTextEditor)([entry.prompt.join('|'), entry.answer.join('|')]);
        edMain.element.style.display = "inline-block";
        edSummary.appendChild(edMain.element);
        var twoSideEd = (0, editor_1.boolEditor)("Double-sided card?", entry.twoSided);
        edDetails.appendChild(twoSideEd.element);
        var readAloudEd = (0, editor_1.boolEditor)("Reversed card can be read aloud?", entry.readAloud);
        edDetails.appendChild(readAloudEd.element);
        return {
            element: edDetails,
            menuToState: () => {
                let tp = edMain.menuToState();
                return {
                    prompt: tp[0].split('|'),
                    answer: tp[1].split('|'),
                    twoSided: twoSideEd.menuToState(),
                    readAloud: readAloudEd.menuToState()
                };
            }
        };
    }
    // abstract makeSettingsEditor(settings: S): StateEditor<S>;
    makeSettingsEditor(settings) {
        var contDiv = document.createElement("div");
        var reverseDetails = document.createElement("details");
        var reverseSummary = document.createElement("summary");
        reverseSummary.textContent = "Two-sided card settings";
        contDiv.appendChild(reverseDetails);
        reverseDetails.appendChild(reverseSummary);
        var twoSidedEditor = (0, editor_1.boolEditor)("Study both sides of two-sided cards?", settings.doTwoSided);
        var twoSidedCont = document.createElement("div");
        twoSidedCont.appendChild(twoSidedEditor.element);
        reverseDetails.appendChild(twoSidedCont);
        var readAloudEditor = (0, editor_1.boolEditor)("Read aloud two-sided cards with setting enabled?", settings.doReadAloud);
        var readAloudCont = document.createElement("div");
        readAloudCont.appendChild(readAloudEditor.element);
        reverseDetails.appendChild(readAloudCont);
        var pReversedEditor = (0, editor_1.scrollNumberEditor)("Probability of card being reversed", settings.probReversed, 0.1, 0.9, 0.1);
        var pSpokenEditor = (0, editor_1.scrollNumberEditor)("Probability of a reversed card using audio", settings.probSpoken, 0.1, 1.0, 0.1);
        reverseDetails.appendChild(pReversedEditor.element);
        reverseDetails.appendChild(pSpokenEditor.element);
        var ssEditor = (0, speech_1.speechSettingsEditor)(settings.speechSettings);
        var ssCont = document.createElement("div");
        ssCont.appendChild(ssEditor.element);
        contDiv.appendChild(ssCont);
        var subsEditor = (0, editor_1.multipleEditors)(settings.substitutions, () => ["", ""], editor_1.doubleTextFieldEditor);
        subsEditor.element = (0, utils_1.hideDetails)(subsEditor.element, "Card substitution settings");
        contDiv.appendChild(subsEditor.element);
        var tplDetails = document.createElement("details");
        var tplSummary = document.createElement("summary");
        tplSummary.textContent = "Card template";
        var tplEditor = (0, editor_1.htmlEditor)(settings.template);
        tplDetails.appendChild(tplSummary);
        tplDetails.appendChild(tplEditor.element);
        contDiv.appendChild(tplDetails);
        return {
            element: contDiv,
            menuToState: () => {
                return {
                    doTwoSided: twoSidedEditor.menuToState(),
                    doReadAloud: readAloudEditor.menuToState(),
                    probReversed: pReversedEditor.menuToState(),
                    probSpoken: pSpokenEditor.menuToState(),
                    speechSettings: ssEditor.menuToState(),
                    substitutions: subsEditor.menuToState(),
                    template: tplEditor.menuToState()
                };
            }
        };
    }
    // abstract getDefaultEntry(): E;
    getDefaultEntry() {
        return {
            prompt: [],
            answer: [],
            twoSided: false,
            readAloud: false
        };
    }
    // abstract getDefaultSettings(): S;
    getDefaultSettings() {
        return {
            doTwoSided: true,
            doReadAloud: true,
            probReversed: 0.5,
            probSpoken: 0.5,
            speechSettings: (0, speech_1.defaultSpeechSettings)(),
            substitutions: [],
            template: nj_templates_1.njSimpleCard
        };
    }
}
exports.SimpleCardType = SimpleCardType;
registerFlashcardType(new SimpleCardType());
class ClozeCardType extends FlashcardType {
    getTypeName() {
        return "cloze-card";
    }
    getUserFriendlyName() {
        return "Cloze puzzle cards";
    }
    cache = new generic_preloader_1.Preloader(10);
    fetchCloze(key, settings) {
        return fetch(`${settings.clozeServerUrl}/cloze?` + new URLSearchParams({
            "srcs": settings.sourceLangs.join(","),
            "groups": settings.clozeGroups.join(","),
            "tgt": settings.targetLang,
            "lemma": key,
            "n": this.cache.numPreload.toString()
        }).toString()).then((r) => r.json()).catch((e) => undefined);
    }
    // abstract preprocessEntry(entry: E, settings: S): void;
    preprocessEntry(entry, settings) {
        this.cache.addKey(entry.key, (k) => this.fetchCloze(entry.key, settings));
    }
    // abstract processEntry(entry: E, settings: S, context: any): Promise<D>;
    processEntry(entry, settings, context) {
        return this.cache.getKey(entry.key, (k) => this.fetchCloze(entry.key, settings)).then((j) => {
            if (j === undefined) {
                return { valid: false, key: entry.key };
            }
            return {
                key: entry.key,
                valid: true,
                cloze: {
                    prompt: j["puzzle"],
                    answer: j["target"],
                    translation: j["source"],
                    group: j["group"]
                }
            };
        }).catch((e) => {
            return { valid: false, key: entry.key };
        });
    }
    // abstract getSearchableText(entry: E): string;
    getSearchableText(entry) {
        return entry.key;
    }
    // abstract getSpeakableText(data: D): string;
    getSpeakableText(data) {
        if (data.valid)
            return data.cloze.answer;
        else
            return "";
    }
    // abstract generateCard(data: D, settings: S, externalParams: IDictionary<any>): Flashcard;
    generateCard(data, settings, externalParams = {}) {
        var fontSize = 5;
        if (data.valid) {
            var fontSize = 900.0 / (10.0 * Math.log(10 + data.cloze.prompt.length));
        }
        var prompt = data.cloze.prompt.replaceAll(/\{\{([^\{\}]+)\}\}/g, "___");
        var templateArgs = {
            key: data.key,
            puzzleFound: data.valid,
            prompt: prompt,
            translation: data.cloze.translation,
            source: data.cloze.group,
            fontSize: fontSize,
        };
        templateArgs = Object.assign({}, templateArgs, externalParams);
        var tpl = settings.template;
        var el = (new DOMParser().parseFromString((0, nunjucks_1.renderString)(tpl, templateArgs), "text/html").body.firstChild);
        return new flashcard_1.Flashcard(el, data.cloze.answer);
    }
    // abstract checkAnswer(answer: string, data: D, settings: S, tf: (s: string) => string): Promise<boolean>;
    checkAnswer(answer, data, settings, tf) {
        return (0, utils_1.trivialPromise)(data.valid && tf(answer) == tf(data.cloze.answer));
    }
    // abstract makeEntryEditor(entry: E): StateEditor<E>;
    makeEntryEditor(entry) {
        var edDetails = document.createElement("details");
        var edSummary = document.createElement("summary");
        edDetails.appendChild(edSummary);
        edDetails.classList.add("cardlist-accordion");
        var keyEd = (0, editor_1.singleTextFieldEditor)(entry.key);
        keyEd.element.style.display = "inline-block";
        edSummary.appendChild(keyEd.element);
        return {
            element: edDetails,
            menuToState: () => {
                return {
                    key: keyEd.menuToState()
                };
            }
        };
    }
    // abstract makeSettingsEditor(settings: S): StateEditor<S>;
    makeSettingsEditor(settings) {
        var clozeSettingsDiv = document.createElement("div");
        var clozeServerDiv = document.createElement("div");
        clozeServerDiv.classList.add("deck-menu-submenu");
        var clozeServerUrlEditor = (0, editor_1.singleTextFieldEditor)(settings.clozeServerUrl);
        var clozeSourceLangEditor = (0, editor_1.singleTextFieldEditor)(settings.sourceLangs.join(','));
        var clozeTargetLangEditor = (0, editor_1.singleTextFieldEditor)(settings.targetLang);
        var clozeGroupsEditor = (0, editor_1.singleTextFieldEditor)(settings.clozeGroups.join(','));
        clozeGroupsEditor.element.placeholder = "allowed groups...";
        var ssEditor = (0, speech_1.speechSettingsEditor)(settings.speechSettings);
        clozeServerDiv.appendChild(clozeServerUrlEditor.element);
        clozeServerDiv.appendChild(clozeSourceLangEditor.element);
        clozeServerDiv.appendChild(clozeTargetLangEditor.element);
        clozeServerDiv.appendChild(clozeGroupsEditor.element);
        clozeSettingsDiv.appendChild(clozeServerDiv);
        clozeSettingsDiv.appendChild(ssEditor.element);
        var tplDetails = document.createElement("details");
        var tplSummary = document.createElement("summary");
        tplSummary.textContent = "Card template";
        var tplEditor = (0, editor_1.htmlEditor)(settings.template);
        tplDetails.appendChild(tplSummary);
        tplDetails.appendChild(tplEditor.element);
        clozeSettingsDiv.appendChild(tplDetails);
        return {
            element: clozeSettingsDiv,
            menuToState: () => {
                return {
                    clozeServerUrl: clozeServerUrlEditor.menuToState(),
                    sourceLangs: clozeSourceLangEditor.menuToState().split(','),
                    targetLang: clozeTargetLangEditor.menuToState(),
                    clozeGroups: clozeGroupsEditor.menuToState().split(',').filter((g) => g.length > 0),
                    speechSettings: ssEditor.menuToState(),
                    template: tplEditor.menuToState()
                };
            }
        };
    }
    // abstract getDefaultEntry(): E;
    getDefaultEntry() {
        return {
            key: ""
        };
    }
    // abstract getDefaultSettings(): S;
    getDefaultSettings() {
        return {
            clozeServerUrl: "",
            sourceLangs: [],
            targetLang: "",
            clozeGroups: [],
            speechSettings: (0, speech_1.defaultSpeechSettings)(),
            template: nj_templates_1.njClozeCard
        };
    }
}
exports.ClozeCardType = ClozeCardType;
registerFlashcardType(new ClozeCardType());
