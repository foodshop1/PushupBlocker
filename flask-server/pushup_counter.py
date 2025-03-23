from flask import Flask, request, jsonify, Response
import cv2
import mediapipe as mp
import numpy as np
import base64
import io
from PIL import Image
import time
from flask_cors import CORS  # Added for handling CORS

# Initialize MediaPipe Pose
mp_drawing = mp.solutions.drawing_utils
mp_pose = mp.solutions.pose

def calculate_angle(a, b, c):
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    
    radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(radians * 180.0 / np.pi)
    
    if angle > 180.0:
        angle = 360 - angle
        
    return angle

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global counter and pose instance
counter = 0
stage = None
last_pushup_time = 0
pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)

@app.route('/api/process_frame', methods=['POST'])
def process_frame():
    global counter, stage, last_pushup_time
    
    try:
        # Get base64 encoded image from request
        data = request.get_json()
        if not data or 'frame' not in data:
            return jsonify({"error": "No frame data received", "success": False}), 400
            
        frame_data = data['frame']
        
        # Decode base64 image
        try:
            # Handle both formats with and without data URL prefix
            if ',' in frame_data:
                frame_bytes = base64.b64decode(frame_data.split(',')[1])
            else:
                frame_bytes = base64.b64decode(frame_data)
        except Exception as e:
            return jsonify({"error": f"Base64 decoding error: {str(e)}", "success": False}), 400
        
        # Convert to OpenCV format
        try:
            image = Image.open(io.BytesIO(frame_bytes))
            frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        except Exception as e:
            return jsonify({"error": f"Image conversion error: {str(e)}", "success": False}), 400
        
        # Process with MediaPipe
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image_rgb.flags.writeable = False
        
        # Make detection
        results = pose.process(image_rgb)
        
        # Process landmarks if detected
        if results.pose_landmarks:
            landmarks = results.pose_landmarks.landmark
            
            # Get coordinates for right arm
            right_shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x,
                             landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
            right_elbow = [landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x,
                          landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y]
            right_wrist = [landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].x,
                          landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].y]
            
            # Calculate elbow angle
            angle = calculate_angle(right_shoulder, right_elbow, right_wrist)
            
            # Check if enough landmarks visible to reliably detect a push-up
            hip_visible = landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].visibility > 0.5
            knee_visible = landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].visibility > 0.5
            
            # Push-up logic
            if hip_visible and knee_visible:
                # Prevent count increments that are too rapid (debounce)
                current_time = time.time()
                
                if angle > 160:
                    new_stage = "up"
                    if stage != new_stage:
                        stage = new_stage
                        
                if angle < 90 and stage == "up":
                    # Only count a pushup if enough time has passed
                    if current_time - last_pushup_time > 0.5:  # 0.5 seconds minimum between pushups
                        stage = "down"
                        counter += 1
                        last_pushup_time = current_time
                        print(f"Push-up count: {counter}")
        
        return jsonify({
            "count": counter,
            "stage": stage if stage else "none",
            "success": True
        })
    
    except Exception as e:
        print(f"Error processing frame: {e}")
        return jsonify({"error": str(e), "success": False}), 500

@app.route('/api/reset_counter', methods=['POST'])
def reset_counter():
    global counter, stage
    counter = 0
    stage = None
    return jsonify({"success": True, "count": counter, "stage": "none"})

@app.route('/api/status', methods=['GET'])
def status():
    return jsonify({"status": "running", "count": counter, "stage": stage if stage else "none"})

# Simple health check endpoint
@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "Pushup counter server is running"})

if __name__ == '__main__':
    print("Starting pushup counter server on http://localhost:5001")
    print("Make sure to install dependencies: flask, flask-cors, opencv-python, mediapipe, numpy, pillow")
    print("Press Ctrl+C to stop the server")
    app.run(host='0.0.0.0', port=5001, debug=True)