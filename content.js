let lastAlertId = null;
let isProcessing = false;
let audioContext = null;

// Kompatybilność Chrome/Firefox
const storageAPI = typeof browser !== 'undefined' ? browser.storage : chrome.storage;

function checkZabbix() {
  if (isProcessing) return;
  
  try {
    // Szukamy pierwszego wiersza w tabeli problemów Zabbixa
    const firstRow = document.querySelector('.list-table tbody tr:first-child');
    
    if (!firstRow) {
      console.log('[Zabbix Alerter] Brak wierszy w tabeli problemów');
      return;
    }

    // Pobieramy unikalny identyfikator - najlepiej eventid jeśli dostępny
    const eventIdCell = firstRow.querySelector('td[data-eventid]');
    const currentAlertId = eventIdCell 
      ? eventIdCell.getAttribute('data-eventid')
      : firstRow.innerText.trim();

    // Pobieramy opis alertu (kolumna Problem - zazwyczaj 5 lub 4)
    const alertDescription = 
      firstRow.querySelector('td:nth-child(5)')?.innerText?.trim() ||
      firstRow.querySelector('td:nth-child(4)')?.innerText?.trim() ||
      firstRow.querySelector('.problem-name')?.innerText?.trim() ||
      "Nowy alert w systemie Zabbix";

    // Sprawdzamy czy to nowy alert
    if (lastAlertId !== currentAlertId) {
      // Pomijamy pierwsze sprawdzenie (przy załadowaniu strony)
      if (lastAlertId !== null) {
        console.log('[Zabbix Alerter] Wykryto nowy alert:', alertDescription);
        triggerAlert(alertDescription);
      } else {
        console.log('[Zabbix Alerter] Inicjalizacja - obecny alert:', alertDescription);
      }
      lastAlertId = currentAlertId;
    }
  } catch (error) {
    console.error('[Zabbix Alerter] Błąd sprawdzania alertów:', error);
  }
}

async function triggerAlert(text) {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // 1. Odtwarzanie dźwięku z pamięci
    await playAlertSound();
    
    // 2. Synteza mowy (TTS) po polsku - czekamy chwilę po dźwięku
    setTimeout(() => {
      speakAlert(text);
    }, 500);
    
  } catch (error) {
    console.error('[Zabbix Alerter] Błąd odtwarzania alertu:', error);
  } finally {
    // Odblokowanie po 5 sekundach (zapobiega wielokrotnemu odtwarzaniu)
    setTimeout(() => {
      isProcessing = false;
    }, 5000);
  }
}

async function playAlertSound() {
  try {
    const data = await storageAPI.local.get('alertAudio');
    
    if (data.alertAudio) {
      const audio = new Audio(data.alertAudio);
      audio.volume = 0.8;
      
      // Promise wrapper dla zdarzenia zakończenia
      return new Promise((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = (e) => {
          console.error('[Zabbix Alerter] Błąd odtwarzania audio:', e);
          resolve(); // Kontynuuj mimo błędu
        };
        
        audio.play().catch(err => {
          console.error('[Zabbix Alerter] Nie można odtworzyć dźwięku:', err);
          resolve(); // Kontynuuj mimo błędu
        });
      });
    } else {
      console.log('[Zabbix Alerter] Brak zapisanego dźwięku alertu');
    }
  } catch (error) {
    console.error('[Zabbix Alerter] Błąd pobierania dźwięku:', error);
  }
}

function speakAlert(text) {
  try {
    if (!window.speechSynthesis) {
      console.error('[Zabbix Alerter] Synteza mowy nie jest dostępna');
      return;
    }

    // Anuluj poprzednie wypowiedzi
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pl-PL';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onerror = (event) => {
      console.error('[Zabbix Alerter] Błąd syntezy mowy:', event.error);
    };

    utterance.onend = () => {
      console.log('[Zabbix Alerter] Zakończono odczytywanie alertu');
    };

    // Dla lepszej kompatybilności - próba z małym opóźnieniem
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 100);
    
  } catch (error) {
    console.error('[Zabbix Alerter] Błąd odczytu tekstu:', error);
  }
}

// Obsługa mutation observer dla dynamicznych zmian
function initMutationObserver() {
  const targetNode = document.querySelector('.list-table tbody');
  
  if (!targetNode) {
    console.log('[Zabbix Alerter] Tabela nie znaleziona, czekam...');
    return;
  }

  const observer = new MutationObserver((mutations) => {
    // Sprawdzaj tylko przy dodaniu/usunięciu wierszy
    const hasStructuralChange = mutations.some(
      mutation => mutation.type === 'childList' && mutation.addedNodes.length > 0
    );
    
    if (hasStructuralChange) {
      console.log('[Zabbix Alerter] Wykryto zmianę w tabeli');
      checkZabbix();
    }
  });

  observer.observe(targetNode, {
    childList: true,
    subtree: true
  });

  console.log('[Zabbix Alerter] Mutation Observer uruchomiony');
}

// Inicjalizacja
function init() {
  console.log('[Zabbix Alerter] Uruchamianie rozszerzenia...');
  
  // Pierwsze sprawdzenie po załadowaniu strony
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(checkZabbix, 1000);
      initMutationObserver();
    });
  } else {
    setTimeout(checkZabbix, 1000);
    initMutationObserver();
  }
  
  // Okresowe sprawdzanie co 30 sekund (backup)
  setInterval(checkZabbix, 30000);
  
  console.log('[Zabbix Alerter] Rozszerzenie gotowe');
}

// Uruchom
init();
