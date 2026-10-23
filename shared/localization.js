(function () {
  'use strict';

  const italian = {
    'Scholarly context worth noticing': 'Contesto scientifico utile',
    'Open quick settings': 'Apri le impostazioni rapide', 'Quick settings': 'Impostazioni rapide', 'Back to results': 'Torna ai risultati',
    'Toolbar shortcut': 'Scorciatoia nella barra degli strumenti',
    'Publisher profile match filters': 'Filtri per le corrispondenze degli editori',
    'Formal integrity filters': 'Filtri per gli aggiornamenti editoriali',
    'Reference result controls': 'Controlli dei risultati dei riferimenti',
    'Filter references': 'Filtra i riferimenti', 'Sort references': 'Ordina i riferimenti',
    'Settings': 'Impostazioni', 'Results': 'Risultati', 'Improve your research checks': 'Migliora i controlli della ricerca',
    'Add useful context to the papers and references you read.': 'Aggiungi informazioni utili agli articoli e ai riferimenti che consulti.',
    'Notice important updates': 'Ricevi aggiornamenti importanti',
    'Crossref checks for retractions, corrections and expressions of concern.': 'Crossref controlla ritrattazioni, correzioni ed espressioni di preoccupazione.',
    'Identify more publisher matches': 'Rileva più editori', 'NCBI fills gaps in PubMed and PMC metadata.': 'NCBI completa i metadati mancanti di PubMed e PMC.',
    'Automatic checks share scholarly identifiers and your IP address with Crossref and NCBI. Turn off anytime.': 'I controlli automatici condividono con Crossref e NCBI gli identificativi scientifici e il tuo indirizzo IP. Puoi disattivarli in qualsiasi momento.',
    'Enable recommended checks': 'Attiva i controlli consigliati', 'Keep current settings': 'Mantieni le impostazioni attuali',
    'Choose individually': 'Scegli singolarmente', 'Data details and current settings': 'Dettagli sui dati e impostazioni attuali',
    'Page text, search queries and page addresses are not sent.': 'Non vengono inviati il testo delle pagine, le query di ricerca né gli indirizzi delle pagine.',
    'Crossref receives DOIs. NCBI receives DOI, PMID or PMCID identifiers. Page text, search queries and page addresses are not sent.': 'Crossref riceve i DOI. NCBI riceve identificativi DOI, PMID o PMCID. Il testo delle pagine, le query di ricerca e gli indirizzi delle pagine non vengono inviati.',
    'Checks run automatically when a page exposes article or reference identifiers. Enable or disable either service in Quick settings, then select Save quick settings.': 'I controlli si avviano automaticamente quando una pagina fornisce identificativi di articoli o riferimenti. Puoi attivare o disattivare i servizi nelle Impostazioni rapide e poi selezionare “Salva le impostazioni rapide”.',
    'FTC judgment (2019)': 'Sentenza della FTC (2019)',
    'Pin Notandia for quick access': 'Aggiungi Notandia alla barra degli strumenti per accedervi rapidamente',
    'Pin Notandia to your toolbar to open reference checks in one click.': 'Aggiungi Notandia alla barra degli strumenti per aprire i controlli dei riferimenti con un clic.',
    'Don’t show again': 'Non mostrare più', 'Publisher watchlist': 'Elenco degli editori monitorati', 'Manage publishers': 'Gestisci editori',
    'Additional publisher and journal warnings': 'Avvisi aggiuntivi su editori e riviste', 'publisher list': 'elenco degli editori',
    'journal list': 'elenco delle riviste', 'publishers': 'editori', 'journals': 'riviste',
    'Check DOIs with Crossref': 'Controlla i DOI con Crossref', 'Only DOI identifiers are transmitted.': 'Vengono trasmessi solo identificativi DOI.',
    'Use NCBI metadata': 'Usa i metadati NCBI', 'Improves publisher detection from PubMed and PMC identifiers.': 'Migliora il rilevamento degli editori tramite gli identificativi PubMed e PMC.',
    'Diagnostic logging': 'Registrazione diagnostica', 'Save quick settings': 'Salva le impostazioni rapide',
    'Reference check': 'Controllo dei riferimenti', 'Checking this page…': 'Controllo di questa pagina…',
    'Scanning citation context…': 'Analisi del contesto delle citazioni…', 'Rescan': 'Analizza di nuovo',
    'Refresh this page': 'Aggiorna questa pagina', 'Filter references by context': 'Filtra i riferimenti per contesto',
    'Filter': 'Filtro', 'All': 'Tutti', 'Context': 'Contesto', 'Badge': 'Etichetta',
    'Formal updates': 'Aggiornamenti post-pubblicazione', 'Publisher matches': 'Corrispondenze con editori',
    'formal update': 'avviso post-pubblicazione', 'Formal update': 'Avviso post-pubblicazione',
    'Withdrawn or removed': 'Ritirato o rimosso', 'Retracted': 'Ritrattato', 'Concern': 'Espressione di preoccupazione',
    'Expression of concern': 'Espressione di preoccupazione',
    'Corrected': 'Corretto', 'Withdrawn': 'Ritirato', 'Duplicate publication': 'Pubblicazione duplicata',
    'Reinstated': 'Ritrattazione revocata', 'Removed': 'Rimosso', 'Check coverage': 'Copertura dei controlli',
    'Integrity lookups are disabled.': 'Le verifiche di integrità sono disattivate.',
    'Formal updates are checked through Crossref and Retraction Watch.': 'Gli avvisi post-pubblicazione sono verificati tramite Crossref e Retraction Watch.',
    'Publisher matches provide context, not a quality verdict. No formal signal means only that none was found in the checked sources.': 'Le corrispondenze con gli editori forniscono contesto, non un giudizio di qualità. L’assenza di una segnalazione post-pubblicazione significa solo che le fonti consultate non ne riportano.',
    'Current article': 'Articolo corrente', 'Article context': 'Contesto dell’articolo', 'References': 'Riferimenti',
    'Scanning publisher profiles and DOI updates…': 'Analisi dei profili degli editori e degli aggiornamenti DOI…',
    'All results': 'Tutti i risultati', 'Reference order': 'Ordine dei riferimenti', 'Most important': 'Più rilevanti',
    'Loading context…': 'Caricamento del contesto…', 'Report an article/context issue': 'Segnala un problema relativo a un articolo o al contesto',
    'Issue category': 'Categoria del problema', 'Publisher not detected': 'Editore non rilevato', 'Wrong publisher detected': 'Editore errato rilevato',
    'Confirmed or potential match is wrong': 'Corrispondenza confermata o potenziale errata', 'Missing retraction or correction': 'Ritrattazione o correzione mancante',
    'Wrong integrity status': 'Stato di integrità errato', 'Page layout or scrolling problem': 'Problema di layout o scorrimento della pagina',
    'Suggest a publisher preset': 'Suggerisci una preimpostazione per un editore', 'Open GitHub report': 'Apri una segnalazione su GitHub',
    'Notandia Settings': 'Impostazioni di Notandia', 'Notandia settings': 'Impostazioni di Notandia',
    'Choose how papers appear and which checks to use.': 'Scegli come visualizzare gli articoli e quali controlli usare.',
    'Publishing concerns': 'Aspetti editoriali da considerare', 'MDPI and Frontiers start with highlighting. Choose a color and action for each publisher.': 'MDPI e Frontiers sono inizialmente evidenziati. Scegli un colore e un’azione per ciascun editore.',
    'Add a publisher manually': 'Aggiungi un editore manualmente', 'Name': 'Nome', 'Publisher name': 'Nome dell’editore',
    'Domains': 'Domini', 'DOI prefixes': 'Prefissi DOI', 'Action': 'Azione', 'Highlight': 'Evidenzia', 'Badge only': 'Solo etichetta',
    'Dim': 'Attenua', 'Hide': 'Nascondi', 'Context only': 'Mostra solo il contesto', 'Color': 'Colore', 'Add publisher': 'Aggiungi editore',
    'Research-integrity checks': 'Verifiche sull’integrità della ricerca',
    'Check article and reference DOIs with Crossref': 'Controlla con Crossref i DOI degli articoli e dei riferimenti',
    'Find retractions, corrections and expressions of concern. Requests send DOIs and your IP address to Crossref.': 'Trova ritrattazioni, correzioni ed espressioni di preoccupazione. Le richieste inviano a Crossref i DOI e il tuo indirizzo IP.',
    'Enable NCBI metadata lookups': 'Attiva le ricerche dei metadati NCBI',
    'Identify publishers from PubMed and PMC records. Requests send article identifiers and your IP address to NCBI.': 'Individua gli editori nei dati di PubMed e PMC. Le richieste inviano a NCBI gli identificativi degli articoli e il tuo indirizzo IP.',
    'Enable diagnostic logging': 'Attiva la registrazione diagnostica', 'Record details to help troubleshoot detection.': 'Registra dettagli utili per risolvere i problemi di rilevamento.',
    'Import or export profiles': 'Importa o esporta i profili', 'Back up your publisher settings or restore them from a JSON export.': 'Crea una copia delle impostazioni degli editori o ripristinale da un’esportazione JSON.',
    'Publisher profile JSON': 'JSON dei profili degli editori', 'Export': 'Esporta', 'Import': 'Importa', 'Reset defaults': 'Ripristina valori predefiniti',
    'Save all settings': 'Salva tutte le impostazioni', 'Open test page': 'Apri la pagina di prova', 'Match policy': 'Criterio di corrispondenza',
    'Why this publisher is included': 'Perché questo editore è nell’elenco', 'Sources reviewed': 'Fonti consultate',
    'Identification preset': 'Profilo di identificazione', 'Journal assessment decisions': 'Decisioni di valutazione delle riviste',
    'Court judgment, 2019': 'Sentenza del tribunale (2019)', 'Community publisher list': 'Elenco comunitario degli editori',
    'Preprint': 'Preprint', 'Encyclopedia entry': 'Voce enciclopedica', 'Reviewed': 'Fonti consultate',
    'CiteWatch note:': 'Nota di CiteWatch:', 'Listed DOI prefixes:': 'Prefissi DOI segnalati:',
    'About this preprint': 'Informazioni su questo preprint', 'About this encyclopedia entry': 'Informazioni su questa voce enciclopedica',
    'Beall’s original publisher list': 'elenco originale di Beall degli editori', 'Beall’s updated publisher list': 'elenco aggiornato di Beall degli editori',
    'Beall’s original journal list': 'elenco originale di Beall delle riviste', 'Beall’s updated journal list': 'elenco aggiornato di Beall delle riviste',
    'Beall’s List: vanity presses': 'Beall’s List: editori a pagamento (vanity press)',
    'Quackwatch: nonrecommended periodicals': 'Quackwatch: periodici non raccomandati',
    'DOAJ: false claims of indexing': 'DOAJ: false affermazioni sull’indicizzazione',
    'Stop Predatory Journals: journals': 'Stop Predatory Journals: riviste',
    'Stop Predatory Journals: publishers': 'Stop Predatory Journals: editori',
    'Prefixes can cover several journals and earlier ownership.': 'Un prefisso può riferirsi a più riviste e a precedenti proprietari.',
    'Name and prefix matches are marked as potential. Open the source entry to review its scope.': 'Le corrispondenze basate su nome e prefisso sono indicate come possibili. Apri la fonte per verificarne l’ambito.',
    'Open the source entry to review its scope.': 'Apri la fonte per verificarne l’ambito.',
    'Wikipedia’s source guide records concerns about MDPI’s peer review and selectivity.': 'La guida alle fonti di Wikipedia riporta dubbi sulla revisione paritaria e sui criteri di selezione di MDPI.',
    'MDPI appeared on Beall’s list in 2014 and was removed in 2015.': 'MDPI compariva nell’elenco di Beall nel 2014 ed è stato rimosso nel 2015.',
    'CiteWatch recommends assessing each journal and paper individually.': 'CiteWatch raccomanda di valutare ogni rivista e ogni articolo singolarmente.',
    'Frontiers has appeared on Beall’s list since October 2015.': 'Frontiers compare nell’elenco di Beall dall’ottobre 2015.',
    'Wikipedia’s 2023 discussion includes both case-by-case caution and arguments for a generally unreliable rating.': 'La discussione del 2023 su Wikipedia presenta sia inviti alla cautela caso per caso sia argomenti a favore di una valutazione generalmente negativa.',
    'Finland’s Publication Forum downgraded 271 MDPI and Frontiers journals in 2025.': 'Nel 2025 il Publication Forum finlandese ha declassato 271 riviste di MDPI e Frontiers.',
    'Some journals kept their ratings or regained them later.': 'Alcune riviste hanno mantenuto la propria classificazione o l’hanno recuperata in seguito.',
    'Norway assesses journals individually.': 'La Norvegia valuta le riviste singolarmente.',
    'The linked sources explain these decisions and their dates.': 'Le fonti collegate spiegano queste decisioni e le relative date.',
    'In 2019, a US court found that OMICS Group and iMedPub LLC misled authors about peer review, editorial boards and publishing fees.': 'Nel 2019 un tribunale statunitense ha stabilito che OMICS Group e iMedPub LLC avevano fornito informazioni ingannevoli agli autori sulla revisione paritaria, sui comitati editoriali e sui costi di pubblicazione.',
    'The FTC case documents the publishers’ practices at that time.': 'Il procedimento della FTC documenta le pratiche degli editori in quel periodo.',
    'This publisher appears in Wikimedia’s community list of predatory publishers, in the edition dated 30 March 2026.': 'Questo editore compare nell’elenco comunitario di Wikimedia degli editori predatori, nell’edizione del 30 marzo 2026.',
    'Contributors compiled the list from Wikipedia and an updated Beall’s list.': 'I contributori hanno compilato l’elenco a partire da Wikipedia e da una versione aggiornata dell’elenco di Beall.',
    'This publisher appears in Wikimedia’s Cite Unseen': 'Questo editore compare nell’elenco Cite Unseen di Wikimedia',
    'list, in the edition dated 30 March 2026.': 'nell’edizione del 30 marzo 2026.',
    'The lists draw on Beall’s list and Wikipedia’s predatory open-access source list.': 'Gli elenchi si basano sull’elenco di Beall e sull’elenco di Wikipedia delle fonti predatorie ad accesso aperto.',
    'The matching entry is': 'La voce corrispondente è',
    'This publisher appears in Wikimedia’s community list of predatory publishers': 'Questo editore compare nell’elenco comunitario di Wikimedia degli editori predatori',
    'Wikipedia CiteWatch lists': 'Wikipedia CiteWatch segnala', 'Its entry cites': 'La relativa voce cita',
    'Listed by Wikipedia CiteWatch': 'Segnalato da Wikipedia CiteWatch', 'Listed by Cite Unseen': 'Segnalato da Cite Unseen',
    'Notandia identifies this publisher through its website links.': 'Notandia identifica questo editore tramite i link presenti sul suo sito web.',
    'Preprints.org shares early research before peer review.': 'Preprints.org diffonde risultati di ricerca preliminari prima della revisione paritaria.',
    'The platform is supported by MDPI.': 'La piattaforma è sostenuta da MDPI.',
    'Check the article page for a published journal version.': 'Controlla nella pagina dell’articolo se ne esiste una versione pubblicata su una rivista.',
    'This DOI identifies an entry posted through MDPI’s Encyclopedia platform.': 'Questo DOI identifica una voce pubblicata sulla piattaforma Encyclopedia di MDPI.',
    'Built-in profiles cannot be removed, but they can be disabled.': 'I profili predefiniti non possono essere rimossi, ma possono essere disattivati.',
    'Secure MDPI Content (Google): Direct MDPI link or NCBI API confirmation.': 'Contenuto MDPI verificato (Google): link diretto a MDPI o conferma tramite API NCBI.',
    'Potential MDPI Content (Google): Text matches MDPI-related keywords.': 'Possibile contenuto MDPI (Google): il testo corrisponde a parole chiave relative a MDPI.',
    'Formal update found': 'Trovato un avviso post-pubblicazione', 'Formal checks off': 'Verifica degli aggiornamenti post-pubblicazione disattivata',
    'Waiting for DOI records': 'In attesa dei dati DOI', 'Scanning citation context and checking formal updates…': 'Analisi delle citazioni e ricerca di avvisi post-pubblicazione…',
    'Scanning publisher profiles and citation links…': 'Analisi dei profili degli editori e dei link alle citazioni…',
    'Waiting for reference checks…': 'In attesa dei controlli dei riferimenti…', 'Connecting to the page scanner…': 'Connessione allo scanner della pagina…',
    'Refresh this page to start checks': 'Aggiorna la pagina per avviare i controlli',
    'Notandia could not connect to this page. Open tabs may need a refresh after installation or an update.': 'Connessione a questa pagina non riuscita. Dopo l’installazione o un aggiornamento, potrebbe essere necessario ricaricare le schede già aperte.',
    'No reference context found': 'Nessun contesto dei riferimenti trovato',
    'Restoring integrity results…': 'Ripristino dei risultati di integrità…', 'Checking formal update records…': 'Verifica degli avvisi post-pubblicazione…',
    'Crossref and NCBI checks enabled.': 'Controlli Crossref e NCBI attivati.',
    'Could not complete setup. Check your lookup settings and try again.': 'Non è stato possibile completare la configurazione. Controlla le impostazioni delle verifiche e riprova.',
    'Could not remember your choice. Please try again.': 'Non è stato possibile memorizzare la scelta. Riprova.',
    'Firefox data permission was not granted. Your settings are unchanged.': 'Non hai concesso l’autorizzazione richiesta da Firefox. Le impostazioni sono rimaste invariate.',
    'Firefox data permission was not granted.': 'Non hai concesso l’autorizzazione richiesta da Firefox.',
    'Publisher:': 'Editore:', 'confirmed match': 'corrispondenza confermata', 'potential match': 'possibile corrispondenza',
    'publisher-domain': 'dominio dell’editore', 'doi-prefix': 'prefisso DOI', 'journal-name': 'nome della rivista',
    'citewatch-doi-prefix': 'prefisso DOI CiteWatch', 'citewatch-metadata-name': 'metadati CiteWatch',
    'community-list-url': 'URL nell’elenco comunitario',
    'Notandia publisher watchlist matches': 'Corrispondenze tra gli editori monitorati da Notandia',
    'Notandia publisher watchlist': 'Elenco degli editori monitorati da Notandia',
    'Looking for publisher matches and formal updates…': 'Ricerca di corrispondenze con gli editori monitorati e di avvisi post-pubblicazione…',
    'No watchlist matches or formal updates were found.': 'Non sono state trovate corrispondenze con gli editori monitorati né avvisi post-pubblicazione.',
    'No references match this filter.': 'Nessun riferimento corrisponde a questo filtro.',
    'Reference checks are still running. Refresh the page if checks do not finish.': 'Le verifiche dei riferimenti sono ancora in corso. Se non terminano, ricarica la pagina.',
    'No publisher matches or known formal updates were found.': 'Non sono stati trovati editori monitorati né avvisi post-pubblicazione noti.',
    'Nothing to review': 'Nessun elemento da esaminare',
    'Scanning scholarly context · formal updates': 'Analisi del contesto scientifico · avvisi post-pubblicazione',
    'Confirmed only': 'Solo corrispondenze confermate', 'Include potential': 'Includi anche quelle possibili',
    'Enable': 'Attiva', 'Added for your own publisher filters.': 'Aggiunto ai tuoi filtri per gli editori.',
    'Enter a publisher name.': 'Inserisci il nome di un editore.',
    'Remove a publisher before adding another. The limit is 50.': 'Rimuovi un editore prima di aggiungerne un altro. Il limite è di 50.',
    'Enter a valid domain or DOI prefix.': 'Inserisci un dominio o un prefisso DOI valido.',
    'Publisher removed. Save settings to apply the change.': 'Editore rimosso. Salva le impostazioni per applicare la modifica.',
    'Publisher settings exported. Copy the JSON below.': 'Impostazioni degli editori esportate. Copia il JSON qui sotto.',
    'Profiles imported. Save settings to apply them.': 'Profili importati. Salva le impostazioni per applicare le modifiche.',
    'Enter a JSON export containing publisher profiles.': 'Inserisci un’esportazione JSON che contenga profili di editori.',
    'Default MDPI and Frontiers profiles restored. Save settings to apply them.': 'Profili predefiniti di MDPI e Frontiers ripristinati. Salva le impostazioni per applicare le modifiche.',
    'Could not save settings.': 'Impossibile salvare le impostazioni.', 'Could not load settings.': 'Impossibile caricare le impostazioni.',
    'Settings saved.': 'Impostazioni salvate.', 'Reports are available only for web pages.': 'È possibile inviare segnalazioni solo dalle pagine web.',
    'Open Extensions beside the address bar, find Notandia, and choose Show in toolbar.': 'Apri il menu Estensioni accanto alla barra degli indirizzi, trova Notandia e scegli “Mostra nella barra degli strumenti”.',
    'Open Extensions, select the gear beside Notandia, and choose Pin to Toolbar.': 'Apri il menu Estensioni, seleziona l’ingranaggio accanto a Notandia e scegli “Aggiungi alla barra degli strumenti”.',
    'Open the Extensions menu (puzzle piece) beside the address bar, then select the pin beside Notandia.': 'Apri il menu Estensioni (l’icona a forma di puzzle) accanto alla barra degli indirizzi, poi seleziona la puntina accanto a Notandia.',
    'Open your browser’s Extensions menu, find Notandia, and choose Pin to toolbar.': 'Apri il menu Estensioni del browser, trova Notandia e scegli “Aggiungi alla barra degli strumenti”.',
    'Language': 'Lingua', 'Extension language': 'Lingua dell’estensione',
    'Choose the language for Quick settings and full Settings. Labels added to open pages update when you save.': 'Scegli la lingua delle impostazioni rapide e di quelle complete. Le etichette di Notandia nelle pagine aperte si aggiornano quando salvi.',
    'Use browser language': 'Usa la lingua del browser', 'English': 'Inglese', 'Italian': 'Italiano'
  };

  const extensionPage = !['http:', 'https:'].includes(location.protocol);
  const injectedRootSelector = '.notandia-publisher-badges, .notandia-integrity-chip';
  const injectedUiSelector = '.notandia-publisher-badges, .notandia-publisher-badge, .notandia-integrity-chip';
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  const trackedAttributeElements = new Set();
  let activeLanguage = 'en';

  function translate(source) {
    if (italian[source]) return italian[source];
    let match;
    if ((match = source.match(/^(\d+) of (\d+) DOI records · (\d+)%$/))) return `Verificati ${match[1]} DOI su ${match[2]} · ${match[3]}%`;
    if (source.includes(' · ')) return source.split(' · ').map(part => translate(part)).join(' · ');
    if ((match = source.match(/^([!•×✎–≡↩])\s*(Retracted|Expression of concern|Corrected|Withdrawn(?: or removed)?|Duplicate publication|Reinstated|Removed)$/))) return `${match[1]} ${italian[match[2]]}`;
    if ((match = source.match(/^(\d+) references? with context$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'riferimento con contesto' : 'riferimenti con contesto'}`;
    if ((match = source.match(/^(\d+) of (\d+) scanned references match your watchlist$/))) return `${match[1]} di ${match[2]} riferimenti analizzati corrispondono agli editori monitorati`;
    if ((match = source.match(/^(\d+) publisher match(?:es)?$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'corrispondenza con un editore' : 'corrispondenze con editori'}`;
    if ((match = source.match(/^(\d+) works? with formal updates$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'articolo con un avviso post-pubblicazione' : 'articoli con avvisi post-pubblicazione'}`;
    if ((match = source.match(/^Checking formal update records… (\d+)\/(\d+) \((\d+)%\)$/))) return `Verifica degli avvisi post-pubblicazione… ${match[1]}/${match[2]} (${match[3]}%)`;
    if ((match = source.match(/^Current settings: Crossref (on|off); NCBI (on|off)\.$/))) return `Impostazioni attuali: Crossref ${match[1] === 'on' ? 'attivo' : 'disattivato'}; NCBI ${match[2] === 'on' ? 'attivo' : 'disattivato'}.`;
    if ((match = source.match(/^(\d+) checked$/))) return `Verificati: ${match[1]}`;
    if ((match = source.match(/^(\d+) not verified$/))) return `Non verificati: ${match[1]}`;
    if ((match = source.match(/^(\d+) deferred$/))) return `Rinviati: ${match[1]}`;
    if ((match = source.match(/^Checking formal updates (\d+)\/(\d+)…$/))) return `Verifica degli avvisi post-pubblicazione ${match[1]}/${match[2]}…`;
    if ((match = source.match(/^Checking (\d+) DOI records$/))) return `Verifica di ${match[1]} DOI…`;
    if ((match = source.match(/^(\d+) of (\d+) references shown$/))) return `Visualizzati ${match[1]} riferimenti su ${match[2]}`;
    if ((match = source.match(/^(\d+) references? shown$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'riferimento visualizzato' : 'riferimenti visualizzati'}`;
    if ((match = source.match(/^Search result (\d+)$/))) return `Risultato di ricerca ${match[1]}`;
    if ((match = source.match(/^Reference (\d+)$/))) return `Riferimento ${match[1]}`;
    if ((match = source.match(/^Show (.+) references$/))) return `Mostra i riferimenti: ${match[1]}`;
    if ((match = source.match(/^(.+): (confirmed|potential) match \((.*)\)$/))) {
      const confidence = match[2] === 'confirmed' ? 'confirmed match' : 'potential match';
      const reasons = match[3].split(/,\s*/).map(reason => italian[reason] || reason).join(', ');
      return `${match[1]}: ${italian[confidence]} (${reasons})`;
    }
    if ((match = source.match(/^(.+) color$/))) return `Colore di ${match[1]}`;
    if ((match = source.match(/^(.+) action$/))) return `Azione per ${match[1]}`;
    if ((match = source.match(/^Enable (.+)$/))) return `Attiva ${match[1]}`;
    if ((match = source.match(/^Remove (.+)$/))) return `Rimuovi ${match[1]}`;
    if ((match = source.match(/^(.+?) · (Preprint|Encyclopedia entry)$/))) return `${match[1]} · ${translate(match[2])}`;
    if ((match = source.match(/^(.+) added\. Save settings to apply it\.$/))) return `${match[1]} aggiunto. Salva le impostazioni per applicare la modifica.`;
    if ((match = source.match(/^Why (.+) is included$/))) return `Perché ${match[1]} è nell’elenco`;
    if ((match = source.match(/^Why (.+) is listed$/))) return `Perché ${match[1]} compare nell’elenco`;
    if ((match = source.match(/^Why (.+) is on the watchlist$/))) return `Perché ${match[1]} è tra gli editori monitorati`;
    if ((match = source.match(/^About this (.+)$/))) return `Informazioni su ${match[1]}`;
    if ((match = source.match(/^This website appears in Wikimedia’s Cite Unseen (standalone-journal|publisher) list, in the edition dated (.+?)\.$/))) return `Questo sito compare nell’elenco Cite Unseen di Wikimedia dedicato a ${match[1] === 'standalone-journal' ? 'riviste indipendenti' : 'editori'}, nell’edizione del ${match[2]}.`;
    if ((match = source.match(/^Wikipedia CiteWatch lists (.+?)\. Its entry cites (.+)\.$/))) return `Wikipedia CiteWatch segnala ${match[1]}. La relativa voce cita ${match[2]}.`;
    if ((match = source.match(/^Open test page for (.+)$/))) return `Apri la pagina di prova di ${match[1]}`;
    if ((match = source.match(/^(.+) receives DOIs\.$/))) return `${match[1]} riceve i DOI.`;
    if ((match = source.match(/^Formal post-publication signal for (.+)$/))) return `Segnalazione post-pubblicazione relativa a ${match[1]}`;
    let localized = source;
    const sourceNotes = [];
    localized = localized.replace(/CiteWatch note: (.*?)(?= Listed DOI prefixes:| Name and prefix matches are marked as potential\.|$)/g,
      (_, note) => `\uE000CITEWATCH${sourceNotes.push(note) - 1}\uE001`);
    localized = localized.replace(/This website appears in Wikimedia’s Cite Unseen (standalone-journal|publisher) list, in the edition dated (.+?)\./g,
      (_, type, date) => `Questo sito compare nell’elenco Cite Unseen di Wikimedia dedicato a ${type === 'standalone-journal' ? 'riviste indipendenti' : 'editori'}, nell’edizione del ${date}.`);
    localized = localized.replace(/Wikipedia CiteWatch lists (.+?)\. Its entry cites (.+?)\./g,
      (_, name, origins) => `Wikipedia CiteWatch segnala ${name}. La relativa voce cita ${origins}.`);
    localized = localized.replace(/Sources reviewed (?=\d{4}-\d{2}-\d{2})/g, 'Fonti consultate ');
    localized = localized.replace(/Reviewed (?=\d{4}-\d{2}-\d{2})/g, 'Fonti consultate ');
    for (const phrase of [
      'Journal assessment decisions', 'Publishing concerns', 'Court judgment, 2019',
      'Community publisher list', 'Listed by Wikipedia CiteWatch', 'Listed by Cite Unseen',
      'Preprint', 'Encyclopedia entry', 'The matching entry is', 'Beall’s original publisher list',
      'Beall’s updated publisher list', 'Beall’s original journal list',
      'Beall’s updated journal list', 'Beall’s List: vanity presses',
      'Quackwatch: nonrecommended periodicals', 'DOAJ: false claims of indexing',
      'Stop Predatory Journals: journals', 'Stop Predatory Journals: publishers'
    ]) {
      localized = localized.replaceAll(phrase, italian[phrase]);
    }
    const phrases = Object.entries(italian)
      .filter(([english]) => /[.:]$/.test(english))
      .sort(([left], [right]) => right.length - left.length);
    for (const [english, italianText] of phrases) {
      if (localized.includes(english)) localized = localized.replaceAll(english, italianText);
    }
    sourceNotes.forEach((note, index) => {
      localized = localized.replace(`\uE000CITEWATCH${index}\uE001`, `${italian['CiteWatch note:']} ${note}`);
    });
    return localized;
  }

  function systemLanguage() {
    return /^it(?:-|$)/i.test(navigator.language || '') ? 'it' : 'en';
  }

  function localizeAttribute(element, attr, trackForLanguageChange = false) {
    const current = element.getAttribute(attr);
    if (!current) return;
    let attributes = originalAttributes.get(element);
    if (!attributes) originalAttributes.set(element, attributes = new Map());
    let record = attributes.get(attr);
    if (!record || current !== record.applied) {
      record = { source: current, applied: null };
      attributes.set(attr, record);
    }
    const localized = activeLanguage === 'it' ? translate(record.source) : record.source;
    record.applied = localized;
    if (current !== localized) element.setAttribute(attr, localized);
    if (trackForLanguageChange) trackedAttributeElements.add(element);
  }

  function localizeRoot(root) {
    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    if (!doc?.createTreeWalker) return;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (extensionPage && node.parentElement?.matches('.context-item > p')) continue;
      let record = originalText.get(node);
      if (!record || node.nodeValue !== record.applied) {
        record = { source: node.nodeValue, applied: null };
        originalText.set(node, record);
      }
      const source = record.source.trim();
      if (!source) continue;
      const localized = activeLanguage === 'it' ? translate(source) : source;
      const start = record.source.indexOf(source);
      record.applied = record.source.slice(0, start) + localized + record.source.slice(start + source.length);
      if (node.nodeValue !== record.applied) node.nodeValue = record.applied;
    }
    const elements = [
      ...(root.matches ? [root] : []),
      ...(root.querySelectorAll?.('[title], [aria-label], [aria-description], [placeholder], [alt]') || [])
    ];
    for (const element of elements) {
      if (extensionPage && element.matches('.context-item > p')) continue;
      for (const attr of ['title', 'aria-label', 'aria-description', 'placeholder', 'alt']) localizeAttribute(element, attr);
    }
  }

  function localize(root) {
    if (!root || !root.ownerDocument && root.nodeType !== 9) return;
    if (extensionPage) {
      localizeRoot(root);
      return;
    }
    const roots = [];
    if (root.matches?.(injectedUiSelector)) roots.push(root);
    if (root.querySelectorAll) {
      const selector = root.nodeType === 9 ? injectedRootSelector : injectedUiSelector;
      roots.push(...root.querySelectorAll(selector));
    }
    for (const ownedRoot of new Set(roots)) localizeRoot(ownedRoot);
  }

  function setLanguage(language = 'system') {
    const preference = ['system', 'en', 'it'].includes(language) ? language : 'system';
    activeLanguage = preference === 'system' ? systemLanguage() : preference;
    if (extensionPage) document.documentElement.lang = activeLanguage;
    localize(document);
    if (!extensionPage) {
      for (const element of trackedAttributeElements) {
        if (!element.isConnected) {
          trackedAttributeElements.delete(element);
          continue;
        }
        const attributes = originalAttributes.get(element);
        for (const attr of attributes?.keys() || []) localizeAttribute(element, attr);
      }
    }
  }

  globalThis.NotandiaI18n = { localize, localizeAttribute: (element, attr) => localizeAttribute(element, attr, true), setLanguage };
  const apply = () => chrome.storage.sync.get({ interfaceLanguage: 'system' }, stored => setLanguage(stored.interfaceLanguage));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
  if (extensionPage) new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) localize(node);
          else if (node.nodeType === 3) localize(node.parentElement);
        }
      } else if (record.type === 'characterData') {
        localize(record.target.parentElement);
      }
    }
  }).observe(document.documentElement, { childList: true, characterData: true, subtree: true });
  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'notandiaSetInterfaceLanguage') setLanguage(message.language);
  });
})();
