// Kompatybilność Chrome/Firefox
const storageAPI = typeof browser !== 'undefined' ? browser.storage : chrome.storage;

// Maksymalny rozmiar pliku (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

document.addEventListener('DOMContentLoaded', loadSettings);

document.getElementById('save').addEventListener('click', saveSettings);
document.getElementById('test').addEventListener('click', testAlert);
document.getElementById('clear').addEventListener('click', clearSettings);

async function loadSettings() {
  try {
    const data = await storageAPI.local.get(['alertAudio', 'audioFileName']);
    
    if (data.alertAudio) {
      document.getElementById('currentFile').textContent = 
        data.audioFileName || 'Zapisany plik audio';
      document.getElementById('currentFile').style.display = 'block';
      document.getElementById('test').disabled = false;
      document.getElementById('clear').disabled = false;
    }
  } catch (error) {
    showStatus('Błąd wczytywania ustawień: ' + error.message, 'error');
  }
}

async function saveSettings() {
  const fileInput = document.getElementById('audioFile');
  const file = fileInput.files[0];

  if (!file) {
    showStatus('Wybierz plik audio!', 'error');
    return;
  }

  // Walidacja typu pliku
  if (!file.type.match('audio.*')) {
    showStatus('Wybierz plik audio (MP3, WAV, OGG)', 'error');
    return;
  }

  // Walidacja rozmiaru
  if (file.size > MAX_FILE_SIZE) {
    showStatus(`Plik jest za duży! Maksymalny rozmiar to ${MAX_FILE_SIZE / 1024 / 1024}MB`, 'error');
    return;
  }

  showStatus('Zapisywanie...', 'info');
  document.getElementById('save').disabled = true;

  try {
    const base64Audio = await readFileAsBase64(file);
    
    await storageAPI.local.set({
      alertAudio: base64Audio,
      audioFileName: file.name
    });

    showStatus('✓ Zapisano pomyślnie!', 'success');
    document.getElementById('currentFile').textContent = file.name;
    document.getElementById('currentFile').style.display = 'block';
    document.getElementById('test').disabled = false;
    document.getElementById('clear').disabled = false;
    
    // Wyczyść input
    fileInput.value = '';
    
  } catch (error) {
    showStatus('Błąd zapisu: ' + error.message, 'error');
  } finally {
    document.getElementById('save').disabled = false;
  }
}

async function testAlert() {
  try {
    const data = await storageAPI.local.get('alertAudio');
    
    if (!data.alertAudio) {
      showStatus('Najpierw zapisz plik audio!', 'error');
      return;
    }

    showStatus('Odtwarzanie testu...', 'info');
    
    // Test dźwięku
    const audio = new Audio(data.alertAudio);
    audio.volume = 0.8;
    
    audio.onerror = () => {
      showStatus('Błąd odtwarzania pliku audio', 'error');
    };
    
    await audio.play();

    // Test TTS po 500ms
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance('Test alertu Zabbix. Wykryto nowy problem w systemie.');
      utterance.lang = 'pl-PL';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      
      utterance.onend = () => {
        showStatus('✓ Test zakończony pomyślnie', 'success');
      };
      
      utterance.onerror = (event) => {
        showStatus('Błąd syntezy mowy: ' + event.error, 'error');
      };
      
      window.speechSynthesis.speak(utterance);
    }, 500);
    
  } catch (error) {
    showStatus('Błąd testu: ' + error.message, 'error');
  }
}

async function clearSettings() {
  if (!confirm('Czy na pewno chcesz usunąć zapisany plik dźwiękowy?')) {
    return;
  }

  try {
    await storageAPI.local.remove(['alertAudio', 'audioFileName']);
    
    document.getElementById('currentFile').style.display = 'none';
    document.getElementById('test').disabled = true;
    document.getElementById('clear').disabled = true;
    document.getElementById('audioFile').value = '';
    
    showStatus('✓ Ustawienia wyczyszczone', 'success');
  } catch (error) {
    showStatus('Błąd czyszczenia: ' + error.message, 'error');
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Nie można wczytać pliku'));
    
    reader.readAsDataURL(file);
  });
}

function showStatus(message, type = 'info') {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + type;
  statusDiv.style.display = 'block';
  
  // Auto-ukryj po 5 sekundach dla success
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }
}
