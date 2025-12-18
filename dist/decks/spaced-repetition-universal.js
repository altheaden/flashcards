"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniversalSpacedRepGen = exports.defaultSRUniversalState = exports.defaultSRUniversalSettings = void 0;
exports.makeSRCardDict = makeSRCardDict;
const utils_1 = require("utils/utils");
const flashcard_1 = require("core/flashcard");
const flashcard_generator_1 = require("core/flashcard-generator");
const speech_1 = require("utils/speech");
const text_filters_1 = require("utils/text-filters");
const editor_1 = require("core/editor");
const nj_templates_1 = require("utils/nj-templates");
const nunjucks_1 = require("nunjucks");
const flashcard_deck_1 = require("core/flashcard-deck");
const spaced_repetition_newqueue_1 = require("utils/spaced-repetition-newqueue");
const flashcard_entry_1 = require("core/flashcard-entry");
const spaced_repetition_universal_types_1 = require("decks/spaced-repetition-universal-types");
/* --- USEFUL UTILITIES FOR DEFINING SR DECK --- */
exports.defaultSRUniversalSettings = {
    cardTypeSettings: {},
    initialHours: 8,
    correctFactor: 1.5,
    incorrectFactor: 0.5,
    fillQOnlyWhenEmpty: true,
    inactiveTags: [],
    readCorrectAnswers: false,
    preventReversedNewCards: false,
    speechSettings: (0, speech_1.defaultSpeechSettings)(),
    filterSettings: text_filters_1.defaultTextFilterSettings
};
function makeSRCardDict(cards) {
    var cardDict = {};
    for (var i in cards) {
        var c = cards[i];
        cardDict[c.guid] = c;
    }
    return cardDict;
}
exports.defaultSRUniversalState = {
    cards: {},
    newQ: (0, spaced_repetition_newqueue_1.emptySRQueue)(10),
    studying: spaced_repetition_universal_types_1.SRStudying.NewCards,
    settings: exports.defaultSRUniversalSettings
};
function makeEmptyCard(cardType) {
    return {
        guid: (0, utils_1.guidGenerator)(),
        cardType: cardType,
        cardEntry: flashcard_entry_1.gCardTypeRegistry[cardType].getDefaultEntry(),
        extraInfo: "",
        tags: [],
        due: new Date(),
        intervalMinutes: 0,
        stats: {
            created: new Date(),
            streak: 0
        }
    };
}
function infoWidgetSR(totalCards, newCards, dueCards) {
    var contDiv = document.createElement("div");
    contDiv.classList.add("deck-menu-submenu");
    var totP = document.createElement("p");
    totP.textContent = `Total cards: ${totalCards}`;
    var newP = document.createElement("p");
    newP.textContent = `New cards: ${newCards}`;
    newP.style.color = "#9999ee";
    newP.style.fontWeight = "bold";
    var dueP = document.createElement("p");
    dueP.textContent = `Due cards: ${dueCards}`;
    dueP.style.color = "#ee9999";
    dueP.style.fontWeight = "bold";
    [totP, newP, dueP].map((el) => contDiv.appendChild(el));
    return contDiv;
}
class UniversalSpacedRepGen extends flashcard_generator_1.FlashcardGen {
    getGenName() { return "universal-spaced-repetition"; }
    // mock-up datetime function for unit testing purposes
    getDate = () => new Date();
    setDate(newDt) { this.getDate = () => newDt; }
    repairDeckState(st) {
        st = (0, utils_1.recursiveRepairJSON)(st, exports.defaultSRUniversalState, ["cards", "cardTypeSettings"]);
        // st.cards = recursiveRepairEachValueJSON(st.cards, Object.values(defaultSRModularState.cards)[0]);
        if (st.settings.cardTypeSettings === undefined) {
            st.settings.cardTypeSettings = {};
        }
        for (var i in Object.keys(flashcard_entry_1.gCardTypeRegistry)) {
            var cardType = Object.keys(flashcard_entry_1.gCardTypeRegistry)[i];
            if (!Object.keys(st.settings.cardTypeSettings).includes(cardType)) {
                st.settings.cardTypeSettings[cardType]
                    = flashcard_entry_1.gCardTypeRegistry[cardType].getDefaultSettings();
            }
            else {
                var currentSettings = st.settings.cardTypeSettings[cardType];
                var repairedSettings = (0, utils_1.recursiveRepairJSON)(currentSettings, flashcard_entry_1.gCardTypeRegistry[cardType].getDefaultSettings());
                st.settings.cardTypeSettings[cardType] = repairedSettings;
            }
        }
        for (var i in Object.keys(st.cards)) {
            var guid = Object.keys(st.cards)[i];
            if (!("extraInfo" in st.cards[guid]) || st.cards[guid].extraInfo === null)
                st.cards[guid].extraInfo = "";
        }
        this.preprocessAllCards(st);
        // Fill the new queue, in case it isn't full yet
        st.newQ = (0, spaced_repetition_newqueue_1.refillNewQueue)(st.newQ, this.getNew(st), true);
        return st;
    }
    cardIsDue(card) {
        return (card.intervalMinutes > 0 && new Date(card.due).valueOf() < this.getDate().valueOf());
    }
    cardIsNew(card) {
        return (card.intervalMinutes == 0);
    }
    getDue(st) {
        return Object.keys(st.cards).filter((k) => this.cardIsDue(st.cards[k]) && this.cardIsEnabled(st.cards[k], st));
    }
    getNew(st) {
        return Object.keys(st.cards).filter((k) => this.cardIsNew(st.cards[k]) && this.cardIsEnabled(st.cards[k], st));
    }
    cardIsEnabled(card, st) {
        return !card.tags.some((t) => st.settings.inactiveTags.includes(t));
    }
    // A pure effect that should be triggered when a card is finally answered correctly
    correctEffect(st, card, attempt, resolve) {
        var cardVirtual = card.virtual;
        var cardTypeSettings = st.settings.cardTypeSettings[cardVirtual.cardType];
        if (st.settings.readCorrectAnswers) {
            flashcard_entry_1.gCardTypeRegistry[cardVirtual.cardType].speakCard(card.processed, cardTypeSettings, resolve);
        }
        else {
            resolve();
        }
    }
    // Update a card's interval based on settings and the attempt's success/failure
    updateInterval(card, settings, correct) {
        var cardData = card.virtual;
        if (correct == flashcard_generator_1.FlashcardResult.Correct) {
            if (cardData.intervalMinutes == 0 && cardData.stats.streak >= 3) {
                return settings.initialHours * 60;
            }
            else if (cardData.intervalMinutes != 0) {
                return cardData.intervalMinutes * settings.correctFactor;
            }
            else {
                return 0;
            }
        }
        else if (correct == flashcard_generator_1.FlashcardResult.Incorrect && cardData.intervalMinutes > 0) {
            return cardData.intervalMinutes * settings.incorrectFactor;
        }
        else {
            return cardData.intervalMinutes;
        }
    }
    updateStats(card, settings, correct) {
        if (correct == flashcard_generator_1.FlashcardResult.Correct) {
            card.virtual.stats.streak += 1;
        }
        else if (correct == flashcard_generator_1.FlashcardResult.Incorrect) {
            card.virtual.stats.streak = 0;
        }
        return card.virtual.stats;
    }
    updateCard(card, st, correct) {
        // Physical card data may be affected by templating or other modifications, so must get card data from deck by its GUID
        var cardVirtual = st.cards[card.virtual.guid];
        if (card.context.isPractice) {
            return cardVirtual;
        }
        var isNew = cardVirtual.intervalMinutes == 0;
        var newStats = this.updateStats(card, st.settings, correct);
        cardVirtual.stats = newStats;
        var newInterval = this.updateInterval(card, st.settings, correct);
        cardVirtual.intervalMinutes = newInterval;
        // Interval > 0 implies the card is no longer new
        // Only reschedule the card if it was answered correctly
        if (correct == flashcard_generator_1.FlashcardResult.Correct && newInterval > 0) {
            cardVirtual.due = this.getDate();
            cardVirtual.due.setHours(cardVirtual.due.getHours() + cardVirtual.intervalMinutes / 60);
        }
        return cardVirtual;
    }
    updateStateAsync(st, card, result) {
        if (result == flashcard_generator_1.FlashcardResult.Unanswered || st.studying == spaced_repetition_universal_types_1.SRStudying.RandomCards) {
            return (0, utils_1.trivialPromise)(st);
        }
        var cardGuid = card.virtual.guid;
        var cardNewState = this.updateCard(card, st, result);
        // If card is still new, stick it back in the queue
        if (card.context.studying === "new") {
            st.newQ = (0, spaced_repetition_newqueue_1.incorporateLast)(st.newQ, cardGuid, this.cardIsNew(cardNewState));
        }
        st.newQ = (0, spaced_repetition_newqueue_1.filterNewQueue)(st.newQ, (id) => this.cardIsEnabled(st.cards[id], st));
        st.newQ = (0, spaced_repetition_newqueue_1.refillNewQueue)(st.newQ, this.getNew(st), true);
        st.cards[cardGuid] = cardNewState;
        return (0, utils_1.trivialPromise)(st);
    }
    getNextCardAsync(st) {
        var inds = Object.keys(st.cards);
        var newInds = this.getNew(st);
        var dueInds = this.getDue(st);
        var emptyCard = this.nextCardAsyncPreprocessing({
            virtual: undefined,
            context: { cardsLeft: 0, isPractice: false, studying: "" }
        }, st);
        if (inds.length == 0) {
            return emptyCard;
        }
        if ((st.studying == spaced_repetition_universal_types_1.SRStudying.NewCards) ||
            (st.studying == spaced_repetition_universal_types_1.SRStudying.NewThenDueCards && newInds.length > 0) ||
            (st.studying == spaced_repetition_universal_types_1.SRStudying.DueThenNewCards && dueInds.length == 0)) {
            var newGuid = (0, spaced_repetition_newqueue_1.chooseNext)(st.newQ, newInds);
            if (newGuid === undefined) {
                return emptyCard;
            }
            return this.nextCardAsyncPreprocessing({
                virtual: st.cards[newGuid],
                context: {
                    cardsLeft: newInds.length,
                    isPractice: false,
                    studying: "new"
                }
            }, st);
        }
        else if ((st.studying == spaced_repetition_universal_types_1.SRStudying.DueCards) ||
            (st.studying == spaced_repetition_universal_types_1.SRStudying.DueThenNewCards) ||
            (st.studying == spaced_repetition_universal_types_1.SRStudying.NewThenDueCards && newInds.length == 0)) {
            if (dueInds.length == 0) {
                return emptyCard;
            }
            var dueInd = dueInds[Math.floor(Math.random() * dueInds.length)];
            return this.nextCardAsyncPreprocessing({
                virtual: st.cards[dueInd],
                context: {
                    cardsLeft: dueInds.length,
                    isPractice: false,
                    studying: "due"
                }
            }, st);
        }
        else if (st.studying == spaced_repetition_universal_types_1.SRStudying.RandomCards) {
            if (inds.length == 0) {
                return emptyCard;
            }
            var ind = inds[Math.floor(Math.random() * inds.length)];
            return this.nextCardAsyncPreprocessing({
                virtual: st.cards[ind],
                context: {
                    cardsLeft: 0,
                    isPractice: true,
                    studying: "random"
                }
            }, st);
        }
        return this.nextCardAsyncPreprocessing({
            virtual: undefined,
            context: {
                cardsLeft: 0,
                isPractice: false,
                studying: ""
            }
        }, st);
    }
    checkAnswerAsync(answer, st, card) {
        if (card.virtual === undefined) {
            return (0, utils_1.trivialPromise)(false);
        }
        var cardType = card.virtual.cardType;
        var cardData = card.processed;
        var tf = (s) => (0, text_filters_1.applyTextFilter)(s, st.settings.filterSettings);
        return flashcard_entry_1.gCardTypeRegistry[cardType].checkAnswer(answer, cardData, st.settings.cardTypeSettings[cardType], tf);
    }
    preprocessAllCards(st) {
        this.getNew(st).map((k) => {
            var c = st.cards[k];
            flashcard_entry_1.gCardTypeRegistry[c.cardType].preprocessEntry(c.cardEntry, st.settings.cardTypeSettings[c.cardType]);
        });
        this.getDue(st).map((k) => {
            var c = st.cards[k];
            flashcard_entry_1.gCardTypeRegistry[c.cardType].preprocessEntry(c.cardEntry, st.settings.cardTypeSettings[c.cardType]);
        });
    }
    nextCardAsyncPreprocessing(card, st) {
        if (card.virtual === undefined) {
            return (0, utils_1.trivialPromise)(card);
        }
        var cardType = card.virtual.cardType;
        var cardEntry = card.virtual.cardEntry;
        var context = { preventReversedCard: card.virtual.intervalMinutes == 0 && st.settings.preventReversedNewCards };
        var dp = flashcard_entry_1.gCardTypeRegistry[cardType].processEntry(cardEntry, st.settings.cardTypeSettings[cardType], context);
        return dp.then((d) => {
            card.processed = d;
            return card;
        });
    }
    generateCardAsync(st, card) {
        if (card.virtual === undefined || card.processed === undefined) {
            var htmlString = (0, nunjucks_1.renderString)(nj_templates_1.njNoCardsLeft, {});
            var el = (new DOMParser().parseFromString(htmlString, "text/html").body.firstChild);
            return (0, utils_1.trivialPromise)(new flashcard_1.Flashcard(el, ""));
        }
        var cardType = card.virtual.cardType;
        var cardEntry = card.virtual.cardEntry;
        var cardProcessed = card.processed;
        var contextDict = { ...card.context };
        contextDict["extra"] = card.virtual.extraInfo;
        var fl = flashcard_entry_1.gCardTypeRegistry[cardType].generateCard(cardProcessed, st.settings.cardTypeSettings[cardType], contextDict);
        return (0, utils_1.trivialPromise)(fl);
    }
    makeEditor(st) {
        var _this = this;
        var contDiv = document.createElement("div");
        var totCards = Object.keys(st.cards).length;
        var newCards = Object.keys(st.cards).filter((i) => this.gen.cardIsNew(st.cards[i]) && this.gen.cardIsEnabled(st.cards[i], st)).length;
        var dueCards = Object.keys(st.cards).filter((i) => this.gen.cardIsDue(st.cards[i]) && this.gen.cardIsEnabled(st.cards[i], st)).length;
        var infoWidget = infoWidgetSR(totCards, newCards, dueCards);
        var studyingEditor = (0, editor_1.radioEditor)(st.studying, [spaced_repetition_universal_types_1.SRStudying.NewCards, spaced_repetition_universal_types_1.SRStudying.DueCards, spaced_repetition_universal_types_1.SRStudying.RandomCards, spaced_repetition_universal_types_1.SRStudying.DueThenNewCards, spaced_repetition_universal_types_1.SRStudying.NewThenDueCards], ["Study new cards", "Study due cards", "Practice random cards", "Study due cards, then new cards", "Study new cards, then due cards"]);
        var newQueueSizeEditor = (0, editor_1.scrollNumberEditor)("Max new cards to study at once: ", st.newQ.maxNewCards, 1, 100, 1);
        var newQueueChunkingEditor = (0, editor_1.boolEditor)("Only refill new card queue once each batch is finished?", st.settings.fillQOnlyWhenEmpty);
        var initHoursEditor = (0, editor_1.scrollNumberEditor)("Initial interval (hours): ", st.settings.initialHours, 1, 240, 1);
        var correctFactor = (0, editor_1.scrollNumberEditor)("Correct factor: ", st.settings.correctFactor, 1, 10, 0.1);
        var incorrectFactor = (0, editor_1.scrollNumberEditor)("Incorrect factor: ", st.settings.incorrectFactor, 0, 1.0, 0.01);
        var omitTagsEditor = (0, editor_1.singleTextFieldEditor)(st.settings.inactiveTags.join(','));
        omitTagsEditor.element.placeholder = "comma-separated tags...";
        var omitTagsCont = document.createElement("div");
        omitTagsCont.textContent = "Omit cards with the following tags: ";
        omitTagsCont.appendChild(omitTagsEditor.element);
        var speechCheckbox = (0, editor_1.boolEditor)("Speak correct answers using text-to-speech?", st.settings.readCorrectAnswers);
        var speechDiv = document.createElement("div");
        speechDiv.appendChild(speechCheckbox.element);
        var preventReversedNewCardsCheckbox = (0, editor_1.boolEditor)("Don't reverse two-sided cards during initial study", st.settings.preventReversedNewCards);
        var omitTagsEditor = (0, editor_1.singleTextFieldEditor)(st.settings.inactiveTags.join(','));
        omitTagsEditor.element.placeholder = "comma-separated tags...";
        var omitTagsCont = document.createElement("div");
        omitTagsCont.textContent = "Omit cards with the following tags: ";
        omitTagsCont.appendChild(omitTagsEditor.element);
        var filterEditor = (0, text_filters_1.textFilterSelectionMenu)(st.settings.filterSettings);
        function makeCardEditor(c) {
            var cardType = c.cardType;
            var cardEntry = c.cardEntry;
            var cardTypeClass = flashcard_entry_1.gCardTypeRegistry[cardType];
            var ed = cardTypeClass.makeEntryEditor(c.cardEntry);
            var extraInfoEd = (0, editor_1.singleTextFieldEditor)(c.extraInfo);
            extraInfoEd.element.placeholder = "extra info...";
            extraInfoEd.element.style.width = "70%";
            ed.element.appendChild(extraInfoEd.element);
            var tagsEd = (0, editor_1.singleTextFieldEditor)(c.tags.join(','));
            tagsEd.element.placeholder = "tags...";
            ed.element.appendChild(tagsEd.element);
            var cardInfo = document.createElement("a");
            cardInfo.classList.add("sr-card-due-date");
            if (c.intervalMinutes == 0) {
                cardInfo.textContent = "not studied";
            }
            else {
                cardInfo.textContent = `due ${(0, utils_1.getSRFutureDateInfo)(c.due)}`;
            }
            ed.element.appendChild(cardInfo);
            var cardMenuToState = () => {
                return {
                    guid: c.guid,
                    cardType: c.cardType,
                    cardEntry: ed.menuToState(),
                    cardData: null,
                    extraInfo: extraInfoEd.menuToState(),
                    tags: tagsEd.menuToState().split(",").filter((t) => t.length > 0),
                    due: c.due,
                    intervalMinutes: c.intervalMinutes,
                    stats: c.stats
                };
            };
            var cardMenuToPreview = () => {
                var cardState = cardMenuToState();
                return _this.gen.nextCardAsyncPreprocessing({
                    virtual: cardState,
                    context: {
                        cardsLeft: 0,
                        isPractice: false
                    }
                }, st);
            };
            var cardPreviewCont = document.createElement("div");
            var previewBtn = (0, utils_1.iconButton)("eyeball.png", () => {
                var cardDataPromise = cardMenuToPreview();
                cardDataPromise.then((d) => {
                    console.log(_this);
                    var cardPreviewDivPromise = _this.gen.generateCardAsync(st, d);
                    console.log(d);
                    cardPreviewDivPromise.then((cardPreviewDiv) => {
                        console.log(cardPreviewDiv);
                        cardPreviewCont.innerHTML = "";
                        cardPreviewDiv.el.classList.add("flashcard");
                        cardPreviewDiv.el.classList.add("flashcard-preview");
                        cardPreviewCont.appendChild(cardPreviewDiv.el);
                    });
                });
            });
            ed.element.appendChild(previewBtn);
            var listenBtn = (0, utils_1.iconButton)("speaker.png", () => {
                var cardDataPromise = cardMenuToPreview();
                var cardTypeSettings = st.settings.cardTypeSettings[c.cardType];
                cardDataPromise.then((c) => {
                    var d = c.processed;
                    cardTypeClass.speakCard(d, cardTypeSettings, () => { });
                });
            });
            ed.element.appendChild(listenBtn);
            ed.element.appendChild(cardPreviewCont);
            return {
                element: ed.element,
                menuToState: cardMenuToState
            };
        }
        var cardSettingsGroups = {};
        var cardEditorGroups = [];
        for (var i in Object.keys(flashcard_entry_1.gCardTypeRegistry)) {
            var t = Object.keys(flashcard_entry_1.gCardTypeRegistry)[i];
            var cardsEditor = ((t) => (0, editor_1.multipleEditors)(Object.values(st.cards).filter((c) => c.cardType == t), () => makeEmptyCard(t), makeCardEditor, true, (s, cd) => flashcard_entry_1.gCardTypeRegistry[t].getSearchableText(cd.cardEntry).includes(s)))(t);
            var cardsEditorCont = document.createElement("div");
            var cardsEditorDetails = document.createElement("details");
            var cardsEditorSummary = document.createElement("summary");
            cardsEditorSummary.textContent = "Add, edit and remove cards";
            cardsEditorDetails.appendChild(cardsEditorSummary);
            cardsEditorDetails.appendChild(cardsEditor.element);
            cardsEditorCont.appendChild(cardsEditorDetails);
            cardsEditor.element = cardsEditorCont;
            cardEditorGroups.push(cardsEditor);
            cardSettingsGroups[t]
                = flashcard_entry_1.gCardTypeRegistry[t].makeSettingsEditor(st.settings.cardTypeSettings[t]);
            var header = document.createElement("h2");
            header.textContent = flashcard_entry_1.gCardTypeRegistry[t].getUserFriendlyName();
            cardsEditor.element.prepend(cardSettingsGroups[t].element);
            cardsEditor.element.prepend(header);
        }
        function getAllCardSettings() {
            var d = {};
            for (var i in Object.keys(flashcard_entry_1.gCardTypeRegistry)) {
                var t = Object.keys(flashcard_entry_1.gCardTypeRegistry)[i];
                d[t] = cardSettingsGroups[t].menuToState();
            }
            return d;
        }
        [
            infoWidget,
            studyingEditor.element,
            initHoursEditor.element,
            newQueueSizeEditor.element,
            newQueueChunkingEditor.element,
            correctFactor.element,
            incorrectFactor.element,
            omitTagsCont,
            preventReversedNewCardsCheckbox.element,
            speechDiv,
            filterEditor.element
        ].concat(cardEditorGroups.map((ed) => ed.element)).map((el) => {
            el.classList.add("deck-menu-submenu");
            contDiv.appendChild(el);
        });
        return {
            element: contDiv,
            menuToState: () => {
                return {
                    studying: studyingEditor.menuToState(),
                    settings: {
                        cardTypeSettings: getAllCardSettings(),
                        initialHours: initHoursEditor.menuToState(),
                        correctFactor: correctFactor.menuToState(),
                        incorrectFactor: incorrectFactor.menuToState(),
                        fillQOnlyWhenEmpty: newQueueChunkingEditor.menuToState(),
                        readCorrectAnswers: speechCheckbox.menuToState(),
                        preventReversedNewCards: preventReversedNewCardsCheckbox.menuToState(),
                        filterSettings: filterEditor.menuToState(),
                        inactiveTags: omitTagsEditor.menuToState().split(",")
                    },
                    newQ: (0, spaced_repetition_newqueue_1.emptySRQueue)(newQueueSizeEditor.menuToState()),
                    cards: (0, utils_1.makeDict)(cardEditorGroups.map((e) => e.menuToState()).flat(1), (c) => c.guid),
                };
            }
        };
    }
}
exports.UniversalSpacedRepGen = UniversalSpacedRepGen;
(0, flashcard_deck_1.registerDeckType)(new UniversalSpacedRepGen(), "universal-spaced-repetition-deck", "Universal spaced repetition deck", exports.defaultSRUniversalState, "#eaa9fc");
