const toggleElements = (showId, hideIds) => {
    if (!showId || !hideIds || !Array.isArray(hideIds)) {
        console.error('Invalid parameters passed to toggleElements');
        return;
    }

    const elementToShow = document.getElementById(showId);
    if (!elementToShow) {
        console.error(`Element with ID '${showId}' not found`);
        return;
    }

    elementToShow.style.display = 'flex';
    hideIds.forEach(id => {
        if (!id) {
            console.warn('Invalid ID in hideIds array');
            return;
        }
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with ID '${id}' not found while hiding elements`);
            return;
        }
        element.style.display = 'none';
    });
};

const updateSectionTitle = (title) => {
    const titleElement = document.getElementById('section-title');
    if (!titleElement) {
        console.error("Section title element not found");
        return;
    }
    titleElement.innerText = title;
};

function showFederal() {
    updateSectionTitle('Federal Criminal Code');
    toggleElements('federal-content', ['municipal-content']);
}

function showMunicipal() {
    updateSectionTitle('Municipal Criminal Code');
    toggleElements('municipal-content', ['federal-content']);
}

function showFRCP() {
    updateSectionTitle('Federal Rules of Civil Procedure');
    toggleElements('frcp-content', ['frcmp-content']);
}

function showFRCMP() {
    updateSectionTitle('Federal Rules of Criminal Procedure');
    toggleElements('frcmp-content', ['frcp-content']);
}

function showConstitution() {
    updateSectionTitle('Constitution');
    toggleElements('constitution-content', ['amendment-content']);
}

function showAmendments() {
    updateSectionTitle('Constitutional Amendments');
    toggleElements('amendment-content', ['constitution-content']);
}

function showDefinition() {
    updateSectionTitle('Definitions');
    toggleElements('definition-content', ['file-content', 'courtprocedure-content', 'people-content', 'opd-content']);
}

function showFile() {
    updateSectionTitle('Files');
    toggleElements('file-content', ['definition-content', 'courtprocedure-content', 'people-content', 'opd-content']);
}

function showCourtProcedure() {
    updateSectionTitle('Court Procedure');
    toggleElements('courtprocedure-content', ['definition-content', 'file-content', 'people-content', 'opd-content']);
}

function showOPD() {
    updateSectionTitle('Office of Public Defender');
    toggleElements('opd-content', ['definition-content', 'file-content', 'courtprocedure-content', 'people-content']);
}

function showPeople() {
    updateSectionTitle('nUSA Legal VIPS');
    toggleElements('people-content', ['definition-content', 'file-content', 'courtprocedure-content', 'opd-content']);
}

function showBoard(volume) {
    const boards = Array.from({length: 16}, (_, i) => `board${i + 2}-content`);
    toggleElements(`board${volume}-content`, boards.filter(id => id !== `board${volume}-content`));
    updateSectionTitle(`Supreme Court Board Volume ${volume}`);
}

function showRuleModal(title, subtitle, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalSubtitle').textContent = subtitle;
    document.getElementById('modalContent').innerHTML = content;
    document.getElementById('ruleModal').style.display = 'block';
}

function closeRuleModal() {
    document.getElementById('ruleModal').style.display = 'none';
}

function initializeTheme() {
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.setAttribute('aria-label', 'Toggle dark mode');
    themeToggle.onclick = toggleTheme;
    document.body.appendChild(themeToggle);

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', savedTheme);
    setTheme(savedTheme);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem('theme')) {
            setTheme(e.matches ? 'dark' : 'light');
        }
    });
}

function setTheme(theme) {
    document.documentElement.removeAttribute('data-theme');
    setTimeout(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        updateThemeIcon(theme);
    }, 1);
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

function updateThemeIcon(theme) {
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.innerHTML = theme === 'light' ? '🌙' : '☀️';
        themeToggle.setAttribute('title', `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`);
    }
}

function initializeBillSearch() {
    const searchInput = document.getElementById('bill-search');
    const filterSelect = document.getElementById('bill-filter');
    const billsContainer = document.getElementById('bills-container');
    
    if (!searchInput || !filterSelect || !billsContainer) return;
    
    const bills = billsContainer.getElementsByClassName('case');
    
    function filterBills() {
        const searchTerm = searchInput.value.toLowerCase();
        const filterValue = filterSelect.value.toLowerCase();

        Array.from(bills).forEach(bill => {
            const title = bill.querySelector('h3').textContent.toLowerCase();
            const description = bill.querySelector('p').textContent.toLowerCase();
            const matchesSearch = title.includes(searchTerm) || description.includes(searchTerm);
            const matchesFilter = filterValue === 'all' || 
                (filterValue === 'hr' && title.startsWith('h.r.')) ||
                (filterValue === 's' && title.startsWith('s.')) ||
                (filterValue === 'hjres' && title.startsWith('h.j.res.')) ||
                (filterValue === 'sjres' && title.startsWith('s.j.res.'));

            bill.style.display = matchesSearch && matchesFilter ? '' : 'none';
        });
    }

    searchInput.addEventListener('input', filterBills);
    filterSelect.addEventListener('change', filterBills);
}

function initializeFRCPFRCMP() {
    const frcpBtn = document.getElementById('frcp-btn');
    const frcmpBtn = document.getElementById('frcmp-btn');
    if (frcpBtn) {
        frcpBtn.onclick = () => showFRCP();
    }

    if (frcmpBtn) {
        frcmpBtn.onclick = () => showFRCMP();
    }

    const ruleCards = document.querySelectorAll('.section-container .rule-card');
    const closeModal = document.getElementById('close-modal');
    const modal = document.getElementById('ruleModal');

    ruleCards.forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', function() {
            const rule = this.getAttribute('data-rule');
            const subtitle = this.getAttribute('data-subtitle');
            const content = this.getAttribute('data-content');
            showRuleModal(rule, subtitle, content);
        });
    });

    if (closeModal) closeModal.addEventListener('click', closeRuleModal);
    if (modal) modal.onclick = event => {
        if (event.target === modal) closeRuleModal();
    };
    
    if (!window._modalEscapeHandlerSet) {
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeRuleModal();
        });
        window._modalEscapeHandlerSet = true;
    }
}

function initializeLaws() {
    if (document.querySelector('.laws-container')) {
        showFederal();
        const federalBtn = document.getElementById('federal-btn');
        const municipalBtn = document.getElementById('municipal-btn');
        if (federalBtn) federalBtn.addEventListener('click', showFederal);
        if (municipalBtn) municipalBtn.addEventListener('click', showMunicipal);

        const ruleCards = document.querySelectorAll('.section-container .rule-card');
        ruleCards.forEach(card => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', function() {
                const rule = this.getAttribute('data-rule');
                const subtitle = this.getAttribute('data-subtitle');
                const content = this.getAttribute('data-content');
                showRuleModal(rule, subtitle, content);
            });
        });

        const modal = document.getElementById('ruleModal');
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeRuleModal();
            }
        });

        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeRuleModal();
            }
        });
    }
}

const articles = {
    'article1': {
        title: 'Article I',
        sections: [
            {
                title: 'Section 1',
                content: 'All legislative Powers herein granted shall be vested in a Congress of the United States, which shall consist of a Senate and House of Representatives.'
            },
            {
                title: 'Section 2',
                content: 'The House of Representatives shall be composed of twenty Representatives, divided into two classes, each being composed of ten members, chosen every two months at times determined by the Federal Elections Commission by the People.<br><br>No Person shall be a Representative who shall not have attained to the Age of six Months on ROBLOX, and been one Month a Citizen of the United States, and who shall, when elected, be an Inhabitant of a different United States of America group on ROBLOX; citizenship by an Individual in the United States shall be defined as membership within the Group except for within the ranks “Immigration Office” and “Foreign Ambassador”, unless Congress by majority vote on a public forum grants an exception on an individual basis; one cannot be a Citizen of the United States while inhabiting a different United States of America group on ROBLOX concurrently.<br><br>If vacancies happen by Resignation or otherwise in the House, there shall be special elections to fill such Vacancies.<br><br>The House of Representatives shall chuse their Speaker and other Officers; and shall have the sole Power of Impeachment.'
            },
            {
                title: 'Section 3',
                content: 'The Senate of the United States shall be composed of twelve Senators, divided into two classes, each being composed of six members, each class being chosen every four months at times determined by the Federal Election Commission by the People.<br><br>If Vacancies happen by Resignation or otherwise in the Senate, there shall be special elections to fill such Vacancies.<br><br>No Person shall be a Senator who shall not have attained to the Age of six Months on ROBLOX, and been two Months a Citizen of the United States, and who shall, when elected, be an Inhabitant of a different United States of America group on ROBLOX.<br><br>The Vice President of the United States shall be President of the Senate, but shall have no Vote, unless they be equally divided.<br><br>The Senate shall chuse their other Officers, and also a President pro tempore, in the Absence of the Vice President, or when he shall exercise the Office of President of the United States.<br><br>The Senate shall have the sole Power to try all Impeachments. When sitting for that Purpose, they shall be on Oath or Affirmation. When the President of the United States is tried, the Chief Justice shall preside: And no Person shall be convicted without the Concurrence of two thirds of the Senate’s Members on a public forum vote.<br><br>Judgement in Cases of Impeachment shall not extend further than to removal from Office, and disqualification to hold and enjoy any Office of honor, Trust or Profit under the United States: but the Party convicted shall nevertheless be liable and subject to Indictment, Trial, Judgement and Punishment, according to Law.'
            },
            {
                title: 'Section 4',
                content: 'The Times, Places and Manner of holding Elections for Senators and Representatives, shall be prescribed by the Congress as a body; but the Federal Elections Commission, ran by Clan Managers, may at any time make or alter such Regulations.<br><br>The Houses of Congress shall assemble at least once in every Week.'
            },
            {
                title: 'Section 5',
                content: 'A ⅓ of members of each shall count as a Quorum to do Business in-game except in cases of Impeachments, Expulsions and Convictions; a simple majority of each entire Body shall be required to do Business on public forum; a two thirds majority of each entire Body on public forum shall be required to do Business requiring two thirds votes; but a smaller Number may adjourn from day to day, and may be authorized to compel the Attendance of absent Members, in such Manner, and under such Penalties as each House may provide.<br><br>Each House may determine the Rules of its Proceedings, punish its Members for disorderly behavior, and, with the Concurrence of two thirds, expel a Member and or Officer; in the cases of expelling Officers, each House must specify whether the Officer shall retain their Membership therein or they shall lose it as well.<br><br>Each House shall keep an online Database of its Proceedings, and from time to time publish the same, excepting such Parts as may in their Judgement require Secrecy; and the Yeas and Nays of the Members of either House on any business shall be recorded.<br><br>Neither House shall, without the Consent of the other, adjourn for more than one Week, nor to any other Place than that in which the two Houses shall be sitting.'
            },
            {
                title: 'Section 6',
                content: 'The Senators and Representatives shall in all Cases, except Treason, Felony and Breach of the Peace, be privileged from Arrest during their Attendance at the Session of their respective Houses, and in going to and returning from the same; and for any Speech or Debate in either House, they shall not be questioned in any other Place.<br><br>No Senator or Representative shall, during the Time for which he was elected, be appointed to a civil office except by granted leave of Congress.'
            },
            {
                title: 'Section 7',
                content: 'Every Bill which shall have passed the House of Representatives and the Senate, shall, before it become a Law, be presented to the President of the United States; If he approve he shall sign it, but if not he shall return it, with his Objections to that House in which it shall have originated, who shall enter the Objections at large on their Database, and proceed to reconsider it. If after such Reconsideration two thirds of that House shall agree to pass the Bill, it shall be sent, together with the Objections, to the other House, by which it shall likewise be reconsidered, and if approved by two thirds of that House, it shall become a Law. But in all such Cases the Votes of both Houses shall be determined by Yeas and Nays, and the Names of the Persons voting for and against the Bill shall be entered on the Database of each House respectively. If any Bill shall not be returned by the President within ten Days after it shall have been presented to him, the Same shall be a Law, in like Manner as if he had signed it, unless the Congress by their Adjournment prevent its Return, in which Case it shall not be a Law.<br><br>Every Order, Resolution, or Vote which has the force of law to which the Concurrence of the Senate and House of Representatives may be necessary (except on a question of Adjournment) shall be presented to the President of the United States; and before the Same shall take Effect, shall be approved by him, or being disapproved by him, shall be repassed by two thirds of the Senate and House of Representatives, according to the Rules and Limitations prescribed in the Case of a Bill.'
            },
            {
                title: 'Section 8',
                content: 'The Congress shall have Power to pay the Debts and provide for the common Defence and general Welfare of the United States; but all Duties, Imposts and Excises shall be uniform throughout the United States;<br><br>To borrow Money on the credit of the United States,<br><br>To regulate all Commerce and Commerce with the Indian Tribes;<br><br>To establish a uniform Rule of Naturalization, and uniform Laws on the subject of Bankruptcies throughout the United States;<br><br>To promote the Progress of Science and useful Arts, by securing for limited Times to Authors and Inventors the exclusive Right to their respective Writings and Discoveries;<br><br>To constitute tribunals inferior to the supreme Court;<br><br>To declare War, grant Letters of Marque and Reprisal, and make Rules concerning Captures on Land and Water;<br><br>To raise and support Armies, but no Appropriation of Money to that Use shall be for a longer Term than two Months;<br><br>To provide and maintain a Navy;<br><br>To make Rules for the Government and Regulation of the land and naval Forces;<br><br>To provide for calling forth the Militia to execute the Laws of the Union, suppress Insurrections and repel Invasions.<br><br>To provide for organizing, arming, appointing Officers of, and disciplining, the Militia, and for governing such Part of them as may be employed in the Service of the United States;<br><br>To exercise exclusive Legislation in all Cases whatsoever, over such District as may, by the Acceptance of Congress, be come the Seat of the Government of the United States, and to exercise like Authority over all Places of the United States for the Erection of Forts, Magazines, Arsenals, dock-Yards, and other needful buildings;—And<br><br>To make all Laws which shall be necessary and proper for carrying into Execution the foregoing Powers, and all other Powers vested by this Constitution in the Government.'
            },
            {
                title: 'Section 9',
                content: 'The Privilege of the Writ of Habeas Corpus shall not be suspended, unless when in Cases of Rebellion or Invasion the public Safety may require it.<br><br>No Bill of Attainder or ex post facto Law shall be passed.'
            },
            {
                title: 'Section 10',
                content: 'No Municipality shall enter into any Treaty, Alliance, or Confederation; grant Letters of Marque and Reprisal coin money; emit Bills of Credit; pass any Bill of Attainder, ex post facto Law, or Law impairing the Obligation of Contracts, or grant any Title of Nobility.<br><br>No Municipality shall, without the Consent of Congress, lay any Duty of Tonnage, keep Troops, or Ships of War in time of Peace, enter into any Agreement or Compact with another Municipality, or with a foreign Power, or engage in War, unless actually invaded, or in such imminent Danger as will not admit of delay.'
            },
            {
                title: 'Section 11',
                content: 'The Senate and House of Representatives shall have the Power to create respective as well as joint- Congressional Committees for the purpose of sub-organization and investigation, whose Chairman and Vice Chairman shall be voted on by their Respective Houses, or in the case of joint committees the entire Congress assembled; and shall be regulated by the election Committee established by Congress.'
            }
        ]
    },
    'article2': {
        title: 'Article II',
        sections: [
            {
                title: 'Section 1',
                content: 'The executive Power shall be vested in a President of the United States of America. He shall hold his Office during the Term of six Months, and, together with the Vice President, chosen for the same Term, be elected, as follows<br><br>The President shall be elected by popular vote of electors, who must be current citizens who have been naturalized for at least one Month and who are not Inhabitants of a different United States of America group on ROBLOX. After the Votes shall have been counted, the Person having the greatest Number of Votes shall become President.<br><br>The Congress may determine the Day on which the Electors shall give their votes.<br><br>No person except a Citizen of the United States shall be eligible to the Office of President; neither shall any Person be eligible to that Office who shall not have attained to the Age six Months on ROBLOX, and been six Months a Citizen within the United States, and who shall, when elected, be an Inhabitant of a different United States of America group on ROBLOX. In Case of the Removal of the President from Office, or of his actual Death, Resignation, or Inability to discharge the Powers and Duties of the said Office, the Same shall devolve on the Vice President, and the Congress may by Law provide for the Case of Removal, actual Death, Resignation or Inability, both of the President and Vice President, declaring what Officer shall then act as President, and such Officer shall act accordingly, until the Disability be removed, or a President shall be elected.<br><br>Before he enter on the Execution of his Office, he shall take the following Oath or Affirmation in-game:—‘‘I do solemnly swear (or affirm) that I will faithfully execute the Office of President of the United States, and will to the best of my Ability, preserve, protect and defend the Constitution of the United States.’’'
            },
            {
                title: 'Section 2',
                content: 'The President shall be Commander in Chief of the Army and Navy of the United States, and of the Militia, when called into the actual Service of the United States; he may require the Opinion, in writing, of the principal Officer in each of the executive Departments, upon any Subject relating to the Duties of their respective Offices, and he shall have Power to grant Reprieves and Pardons for Offences against the United States, except in Cases of Impeachment.<br><br>He shall have Power, by and with the Advice and Consent of the Senate, to make Treaties, provided two thirds of the Senators present concur; and he shall nominate, and by and with the Advice and Consent of the Senate, shall appoint Ambassadors, other public Ministers and Consuls, Judges of the supreme Court, and all other Officers of the United States, whose Appointments are not herein otherwise provided for, and which shall be established by Law: but the Congress may by Law vest the Appointment of such inferior Officers, as they think proper, in the President alone, in the Courts of Law, or in the Heads of Departments.'
            },
            {
                title: 'Section 3',
                content: 'He shall from time to time give to the Congress Information of the State of the Union, and recommend to their Consideration such Measures as he shall judge necessary and expedient; he may, on extraordinary Occasions, convene both Houses, or either of them, and in Case of Disagreement between them, with Respect to the Time of Adjournment, he may adjourn them to such Time as he shall think proper; he shall receive Ambassadors and other public Ministers; he shall take Care that the Laws be faithfully executed, and shall Commission all the Officers of the United States.'
            },
            {
                title: 'Section 4',
                content: 'The President, Vice President and all civil Officers of the United States, shall be removed from Office on Impeachment for, and Conviction of, Treason, Bribery, severe inactivity, or other high Crimes and Misdemeanors.'
            }
        ]
    },
    'article3': {
        title: 'Article III',
        sections: [
            {
                title: 'Section 1',
                content: 'The judicial Power of the United States, shall be vested in one supreme Court, and in such inferior Courts as the Congress may from time to time ordain and establish. The Judges, both of the supreme and inferior Courts, shall hold their Offices during good Behaviour.'
            },
            {
                title: 'Section 2',
                content: 'The judicial Power shall extend to all Cases, in Law and Equity, arising under this Constitution, the Laws of the United States, and Treaties made, or which shall be made, under their Authority;—to all Cases affecting Ambassadors, other public Ministers and Consuls;— to all Cases of admiralty and maritime Jurisdiction;—to Controversies to which the United States will be a party;— to Controversies between two or more Municipalities;— between a Municipality and Citizens of another Municipality;— between Citizens of different Municipalities,— between Citizens of the same Municipality claiming Lands under Grants of different Municipalities, and between a Municipality, or the Citizens thereof, and foreign States, Citizens or Subjects. No court shall be established by a Municipality.<br><br>In all Cases affecting Ambassadors, other public Ministers and Consuls, and those in which a Municipality shall be Party, the supreme Court shall have original Jurisdiction. In all the other Cases before mentioned, the supreme Court shall have appellate Jurisdiction, both as to Law and Fact, with such Exceptions, and under such Regulations as the Congress shall make.<br><br>The Trial of all Crimes, except in Cases of Impeachment, shall be by Jury or, with consent of the defendant or defendants, Bench; and such Trial shall be held in a federal district Court, except for cases arising in the Army and Navy of the United States and the Militia, whose Trials shall be held in a Place or Places as the Congress may by Law have directed.'
            },
            {
                title: 'Section 3',
                content: 'Treason against the United States, shall consist only in levying War against them, or in adhering to their Enemies, giving them Aid and Comfort. No Person shall be convicted of Treason unless on the Testimony of two Witnesses to the same overt Act, or on Confession in open Court.<br><br>The Congress shall have Power to declare the Punishment of Treason, but no Attainder of Treason shall work Corruption of Blood, or Forfeiture except during the Life of the Person attainted.'
            },
            {
                title: 'Section 4',
                content: 'The supreme Court shall have the power at anytime when it deems necessary to exercise a Review of the Executive or Legislative branches, and through this exercise may overturn any Law, executive Order, or other action if it finds it to be unconstitutional or unlawful; the supreme Court may issue all Writs necessary or appropriate in aid of its respective jurisdictions to carry out these Reviews.'
            },
            {
                title: 'Section 5',
                content: 'Invested in all courts of the Judiciary shall be the ability to issue Warrants for arrest upon entering of charges by the federal Government;<br><br>Unless a trial occurs within seventy two hours of the issuance of the Warrant and charges have been actively pursued by the federal Government for its duration, it shall be removed.<br><br>The supreme Court shall have the sole power to issue arrest Warrants on groups, and shall remove them unless a trial occurs within seventy two hours of the issuance of the Warrant and charges have been actively pursued by the federal Government for its duration.'
            }
        ]
    },
    'article4': {
        title: 'Article IV',
        sections: [
            {
                title: 'Section 1',
                content: 'Full faith and Credit shall be given in each Municipality to the public Acts, Records and Proceedings of every other Municipality. And the Congress may by general Laws prescribe the Manner in which such Acts, Records and Proceedings shall be proved, and the Effect thereof.'
            },
            {
                title: 'Section 2',
                content: 'Americans shall be entitled to all Privileges and Immunities in the several Municipalities'
            },
            {
                title: 'Section 3',
                content: 'New Municipalities may be admitted by Congress into this Union but no new Municipality shall be formed or erected within the Jurisdiction of any other Municipality; nor any Municipality be formed by the Junction of two or more Municipalities, or Parts of Municipalities, without the Consent of the Legislatures of the Municipalities concerned as well as of the Congress.<br><br>The Congress shall have Power to dispose of and make all needful Rules and Regulations respecting the Territory or other Property belonging to the United States; and nothing in this Constitution shall be so construed as to Prejudice any Claims of the United States, or of any particular Municipality.'
            },
            {
                title: 'Section 4',
                content: 'The United States shall guarantee to every Municipality in this Union a Republican Form of Government, and shall protect each of them against Invasion; and on Application of the Legislature, or of the Executive (when the Legislature cannot be convened) against domestic Violence.'
            }
        ]
    },
    'article5': {
        title: 'Article V',
        sections: [
            {
                title: 'Section 1',
                content: 'The Congress, whenever two thirds of both Houses shall deem it necessary, shall propose Amendments to this Constitution, which shall take effect after review, comment and approval of a majority of the Supreme Court sitting for that purpose. Such review, comment and approval, or lack of approval, shall be transmitted by the Supreme Court within ten days. If the Supreme Court shall not transmit any review, comment, approval, or lack of approval, within ten days, it shall be returned to the Congress as not approved by the Supreme Court.'
            },
            {
                title: 'Section 2',
                content: 'The Congress may, after receiving notice of rejection of a proposed amendment by the Supreme Court, return such amendment to the floor of each Chamber to be approved by two-thirds of the total membership of each chamber, in which case it shall take effect.'
            }
        ]
    }
};

let currentArticle = null;
let currentSectionIndex = 0;

function openConstitutionModal(articleId) {
    const article = articles[articleId];
    if (!article) return;

    currentArticle = articleId;
    currentSectionIndex = 0;
    updateConstitutionModal();

    const modal = document.getElementById('constitutionModal');
    modal.style.display = 'block';
}

function updateConstitutionModal() {
    const article = articles[currentArticle];
    const section = article.sections[currentSectionIndex];

    document.getElementById('articleTitle').textContent = `${article.title}\n${section.title}`;
    document.getElementById('sectionContent').innerHTML = section.content;
    document.getElementById('sectionIndicator').textContent = 
        `Section ${currentSectionIndex + 1} of ${article.sections.length}`;

    const prevButton = document.querySelector('.constitution-nav-modal .prev');
    const nextButton = document.querySelector('.constitution-nav-modal .next');
    
    prevButton.disabled = currentSectionIndex === 0;
    nextButton.disabled = currentSectionIndex === article.sections.length - 1;
}

function navigateSection(direction) {
    const article = articles[currentArticle];
    const newIndex = currentSectionIndex + direction;

    if (newIndex >= 0 && newIndex < article.sections.length) {
        currentSectionIndex = newIndex;
        updateConstitutionModal();
    }
}

function initializeConstitution() {
    const constitutionBtn = document.getElementById('constitution-btn');
    const amendmentsBtn = document.getElementById('amendments-btn');

    constitutionBtn?.addEventListener('click', showConstitution);
    amendmentsBtn?.addEventListener('click', showAmendments);

    document.querySelectorAll('.rule-card').forEach(card => {
        card.addEventListener('click', () => {
            const rule = card.getAttribute('data-rule');
            const content = card.getAttribute('data-content');
            showRuleModal(rule, '', content);
        });
    });

    document.querySelectorAll('.article-card').forEach(card => {
        card.addEventListener('click', () => {
            const articleId = card.getAttribute('data-article');
            openConstitutionModal(articleId);
        });
    });

    const constitutionModal = document.getElementById('constitutionModal');
    if (constitutionModal) {
        constitutionModal.querySelector('.close')?.addEventListener('click', () => {
            constitutionModal.style.display = 'none';
        });

        constitutionModal.querySelector('.prev')?.addEventListener('click', () => navigateSection(-1));
        constitutionModal.querySelector('.next')?.addEventListener('click', () => navigateSection(1));

        const modalOverlay = constitutionModal.querySelector('.modal-overlay');
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                constitutionModal.style.display = 'none';
            }
        });

        window.addEventListener('keydown', (e) => {
            if (constitutionModal.style.display === 'block') {
                if (e.key === 'ArrowLeft') {
                    navigateSection(-1);
                    e.preventDefault();
                } else if (e.key === 'ArrowRight') {
                    navigateSection(1);
                    e.preventDefault();
                }
            }
        });
    }

    const ruleModal = document.getElementById('ruleModal');
    if (ruleModal) {
        ruleModal.addEventListener('click', (e) => {
            if (e.target === ruleModal) {
                closeRuleModal();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeRuleModal();
            const constitutionModal = document.getElementById('constitutionModal');
            if (constitutionModal) constitutionModal.style.display = 'none';
        }
    });
}

function initializeCourts() {
    showBoard(2);
    const volumeButtons = document.querySelectorAll('[data-board]');
    volumeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const volume = parseInt(button.dataset.board);
            showBoard(volume);
        });
    });
}

function initializeResources() {
    showDefinition();
    const definitionsBtn = document.getElementById('definitions-btn');
    const filesBtn = document.getElementById('files-btn');
    const courtProcedureBtn = document.getElementById('court-procedure-btn');
    const opdBtn = document.getElementById('opd-btn');
    const peopleBtn = document.getElementById('people-btn');

    if (definitionsBtn) definitionsBtn.addEventListener('click', showDefinition);
    if (filesBtn) filesBtn.addEventListener('click', showFile);
    if (courtProcedureBtn) courtProcedureBtn.addEventListener('click', showCourtProcedure);
    if (opdBtn) opdBtn.addEventListener('click', showOPD);
    if (peopleBtn) peopleBtn.addEventListener('click', showPeople);
}

function initializePage() {
    initializeTheme();
    const path = window.location.pathname;
    const filename = path.split('/').pop();

    if (filename === 'congress.html' || filename === 'congress') {
        initializeBillSearch();
    } else if (filename === 'frcp-frcmp.html' || filename === 'frcp-frcmp') {
        initializeFRCPFRCMP();
    } else if (filename === 'constitution.html' || filename === 'constitution') {
        initializeConstitution();
    } else if (filename === 'laws.html' || filename === 'laws') {
        initializeLaws();
    } else if (filename === 'courts.html' || filename === 'courts') {
        initializeCourts();
    } else if (filename === 'resources.html' || filename === 'resources') {
        initializeResources();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}
    
const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNlMGUwZTAiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM1IiByPSIyMCIgZmlsbD0iIzljOWM5YyIvPjxwYXRoIGQ9Ik0xNSw4NWMwLTIwLDE1LTM1LDM1LTM1czM1LDE1LDM1LDM1IiBmaWxsPSIjOWM5YzljIi8+PC9zdmc+';
    
    const API_CONFIG = {
        PRIMARY_URL: 'https://api.realelijahjunaid.workers.dev',
        FALLBACK_URL: 'https://backup-api.realelijahjunaid.workers.dev',
        TIMEOUT: 5000
    };

    async function fetchWithFallback(endpoint, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

        try {
            const response = await fetch(`${API_CONFIG.PRIMARY_URL}${endpoint}`, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeout);
            return response;
        } catch (error) {
            console.warn(`Primary API failed, trying fallback: ${error.message}`);
            try {
                const fallbackResponse = await fetch(`${API_CONFIG.FALLBACK_URL}${endpoint}`, options);
                return fallbackResponse;
            } catch (fallbackError) {
                throw new Error(`Both primary and fallback APIs failed: ${fallbackError.message}`);
            }
        }
    }

    const vipData = [
        { userId: '731724654', title: 'Retired Justice', reason: 'Bob' },
        { userId: '25439051', title: 'Disgrace', reason: 'Bob' },
        { userId: '12018674', title: 'Senior Counsel to the Clerk of the Court', reason: 'Bob' },
        { userId: '526267693', title: 'Retired Judge in Active Service', reason: 'Bob' },
        { userId: '28563851', title: 'Retired Justice', reason: 'Bob' },
        { userId: '173567162', title: 'Retired Justice', reason: 'Bob' },
        { userId: '1118551761', title: 'Retired Judge', reason: 'Bob' },
        { userId: '57480164', title: 'Retired Justice', reason: 'Bob' },
        { userId: '35066678', title: 'Retired Justice', reason: 'Bob' },
        { userId: '62419630', title: 'Clerk of the Court', reason: 'Bob' },
        { userId: '69665369', title: 'Clerk of the Supreme Court', reason: 'Bob' },
        { userId: '116389487', title: 'Assistant Clerk of the Court', reason: 'Owner of this website' },
    ];

    async function loadVIPData() {
        await new Promise(resolve => setTimeout(resolve, 100));
        const vipContainer = document.getElementById('vip-container');
        if (document.querySelectorAll('.vip-container').length == 0) {
            console.error('VIP container element not found');
            return;
        }

        const loadingMessage = document.createElement('div');
        loadingMessage.textContent = 'Loading VIP data...';
        vipContainer.appendChild(loadingMessage);

        let successCount = 0;
        const totalVIPs = vipData.length;

        for (const vip of vipData) {
            try {
                const [userResponse, avatarResponse] = await Promise.allSettled([
                    fetchWithFallback(`/users/${vip.userId}`),
                    fetchWithFallback(`/avatar/${vip.userId}`)
                ]);

                const userData = userResponse.status === 'fulfilled' && userResponse.value.ok ? 
                    await userResponse.value.json() : null;
                
                const avatarData = avatarResponse.status === 'fulfilled' && avatarResponse.value.ok ?
                    await avatarResponse.value.json() : null;

                const username = userData?.name || `User ${vip.userId}`;
                const imageUrl = avatarData?.data[0]?.imageUrl || DEFAULT_AVATAR;

                const vipCard = document.createElement('div');
                vipCard.classList.add('vip-card');
                vipCard.setAttribute('role', 'article');
                vipCard.innerHTML = `
                    <div class="vip-left">
                        <div class="vip-image">
                            <img src="${imageUrl}" 
                                 alt="${username}'s Avatar" 
                                 loading="lazy"
                                 onerror="this.src='${DEFAULT_AVATAR}'"
                                 width="100"
                                 height="100">
                        </div>
                        <div class="vip-details">
                            <h3>${username}</h3>
                            <p>${vip.title}</p>
                        </div>
                    </div>
                    <div class="vip-reason">
                        <p>${vip.reason}</p>
                    </div>
                `;
                vipContainer.appendChild(vipCard);
                successCount++;
            } catch (error) {
                console.warn(`Failed to load data for user ID ${vip.userId}`, error);
                const fallbackCard = document.createElement('div');
                fallbackCard.classList.add('vip-card', 'error-state');
                fallbackCard.setAttribute('role', 'article');
                fallbackCard.innerHTML = `
                    <div class="vip-left">
                        <div class="vip-details">
                            <h3>User ${vip.userId}</h3>
                            <p>${vip.title}</p>
                        </div>
                    </div>
                    <div class="vip-reason">
                        <p>${vip.reason}</p>
                    </div>
                `;
                vipContainer.appendChild(fallbackCard);
            }
        }

        loadingMessage.remove();
        if (successCount < totalVIPs) {
            const warningMessage = document.createElement('div');
            warningMessage.classList.add('warning-message');
            warningMessage.textContent = `Some VIP data could not be loaded (${successCount}/${totalVIPs} successful)`;
            vipContainer.insertBefore(warningMessage, vipContainer.firstChild);
        }
    }

    const initializeElements = () => {
        const requiredElements = [
            { 
                selector: '#section-title, .centered-title', 
                description: 'Section title element',
                required: false
            }
        ];

        if (window.location.pathname.includes('resources')) {
            requiredElements.push({ 
                selector: '#vip-container, .vip-container', 
                description: 'VIP container',
                required: true
            });
        }

        const missingElements = [];
        for (const { selector, description, required = true } of requiredElements) {
            if (required && !document.querySelectorAll(selector)) {
                console.log(document.querySelector(selector));
                missingElements.push(description);
            }
        }

        if (missingElements.length > 0) {
            console.error('Missing required elements: ' + missingElements.join(', '));
            return true;
        }
        return true;
    };

    if (initializeElements()) {
        if (window.location.pathname.includes('resources')) {
            loadVIPData().catch(error => {
                console.error('Failed to load VIP data:', error);
                const vipContainer = document.getElementById('vip-container');
                if (vipContainer) {
                    vipContainer.innerHTML = '<div class="error-message">Failed to load VIP data. Please try again later.</div>';
                }
            });
        }
    }