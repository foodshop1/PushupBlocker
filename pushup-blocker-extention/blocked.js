// Get parameters from URL
const urlParams = new URLSearchParams(window.location.search);
const blockedSite = urlParams.get('site');
const originalUrl = `https://${blockedSite}`;

// DOM elements
const videoElement = document.getElementById('videoElement');
const pushupCountElement = document.getElementById('pushupCount');
const requiredCountElement = document.getElementById('requiredCount');
const requiredPushupsElement = document.getElementById('requiredPushups');
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');
const statusElement = document.getElementById('status');
const errorElement = document.getElementById('error');
const loadingElement = document.getElementById('loading');

// Settings
let requiredPushups = 10; // Default, will be updated from storage
let currentCount = 0;
let serverUrl = 'http://localhost:5001'; // Flask server URL
let streamInterval;
let isTracking = false;

// Load required pushup count from storage
chrome.runtime.sendMessage({ action: "getPushupCount" }, (response) => {
  requiredPushups = response.pushupCount;
  requiredCountElement.textContent = requiredPushups;
  requiredPushupsElement.textContent = requiredPushups;
});

// Start camera stream
async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: 640, 
        height: 480,
        facingMode: 'user' // Front camera
      } 
    });
    
    videoElement.srcObject = stream;
    loadingElement.style.display = 'none';
    return true;
  } catch (error) {
    console.error('Error accessing camera:', error);
    errorElement.textContent = `Camera error: ${error.message}`;
    loadingElement.style.display = 'none';
    return false;
  }
}

// Start tracking pushups
async function startTracking() {
  if (isTracking) return;
  
  const cameraReady = await setupCamera();
  if (!cameraReady) return;
  
  statusElement.textContent = 'Tracking pushups...';
  isTracking = true;
  startButton.classList.add('disabled');
  
  // Reset the counter on the server
  try {
    await fetch(`${serverUrl}/api/reset_counter`, { method: 'POST' });
    currentCount = 0;
    pushupCountElement.textContent = currentCount;
  } catch (error) {
    errorElement.textContent = `Server error: ${error.message}`;
    stopTracking();
    return;
  }
  
  // Start sending frames to the server
  streamInterval = setInterval(captureAndSendFrame, 100); // 10 FPS
}

// Capture video frame and send to Flask server
async function captureAndSendFrame() {
  try {
    // Create a canvas to capture the frame
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    // Draw the current video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Send to the server
    const response = await fetch(`${serverUrl}/api/process_frame`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ frame: imageData })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update the pushup count
      currentCount = data.count;
      pushupCountElement.textContent = currentCount;
      
      // Update status based on stage
      if (data.stage === "up") {
        statusElement.textContent = 'Push up position detected';
      } else if (data.stage === "down") {
        statusElement.textContent = 'Down position detected - keep going!';
      }
      
      // Check if we've reached the required count
      if (currentCount >= requiredPushups) {
        completedPushups();
      }
    }
  } catch (error) {
    console.error('Error sending frame:', error);
    errorElement.textContent = `Server connection error: ${error.message}`;
  }
}

// Handle pushup completion
function completedPushups() {
  stopTracking();
  statusElement.textContent = 'Great job! You can now access the site for 30 minutes.';
  
  // Unblock the site temporarily
  chrome.runtime.sendMessage({ 
    action: "temporarilyUnblock", 
    domain: blockedSite,
    duration: 30 * 60 * 1000, // 30 minutes
    redirectUrl: originalUrl
  });
}

// Stop tracking
function stopTracking() {
  isTracking = false;
  if (streamInterval) {
    clearInterval(streamInterval);
  }
  startButton.classList.remove('disabled');
  
  // Stop the camera
  if (videoElement.srcObject) {
    const tracks = videoElement.srcObject.getTracks();
    tracks.forEach(track => track.stop());
    videoElement.srcObject = null;
  }
}

// Reset counter
async function resetCounter() {
  try {
    await fetch(`${serverUrl}/api/reset_counter`, { method: 'POST' });
    currentCount = 0;
    pushupCountElement.textContent = currentCount;
    statusElement.textContent = 'Counter reset';
  } catch (error) {
    errorElement.textContent = `Server error: ${error.message}`;
  }
}

// Event listeners
startButton.addEventListener('click', startTracking);
resetButton.addEventListener('click', resetCounter);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  statusElement.textContent = `Site blocked: ${blockedSite}`;
});