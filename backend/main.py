from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io
import torch
from transformers import BlipProcessor, BlipForConditionalGeneration

import numpy as np
import webcolors
from scipy.spatial import KDTree
from sklearn.cluster import MiniBatchKMeans # Use MiniBatchKMeans for speed on larger images

app = FastAPI()

# Configure CORS to allow your React frontend to communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")

device = "cuda" if torch.cuda.is_available() else "cpu"
model.to(device)
print(f"Using device: {device}")

# --- Initialize color data using webcolors.names() and webcolors.name_to_rgb() ---
CSS3_COLORS_RGB = []
CSS3_COLORS_NAMES = []
for name in webcolors.names("css3"): 
    try:
        rgb_tuple = webcolors.name_to_rgb(name)
        CSS3_COLORS_RGB.append(rgb_tuple)
        CSS3_COLORS_NAMES.append(name)
    except ValueError:
        print(f"Warning: Could not get RGB for color name '{name}'")

COLOR_NAMES_KD_TREE = KDTree(CSS3_COLORS_RGB)

def get_closest_color_name(rgb_tuple):
    """
    Find the closest color name to the given RGB value using KDTree.
    """
    # Ensure rgb_tuple is a list or tuple for KDTree.query
    distance, index = COLOR_NAMES_KD_TREE.query(list(rgb_tuple)) 
    return CSS3_COLORS_NAMES[index]

# --- MODIFIED: Function to get multiple dominant colors using K-means ---
def get_dominant_colors(image_pil, num_colors=5):
    """
    Extracts 'num_colors' dominant colors from the image using K-means clustering
    and returns their closest CSS3 names.
    """
    resized_image = image_pil.resize((200, 200))
    pixels = np.array(resized_image)
    
    # Reshape the image to be a list of pixels (N, 3) where N is num_pixels
    flat_pixels = pixels.reshape(-1, 3)

    # Use MiniBatchKMeans for efficiency, especially with larger images or more clusters
    # random_state for reproducibility
    kmeans = MiniBatchKMeans(n_clusters=num_colors, random_state=0, n_init=10) 
    kmeans.fit(flat_pixels)

    # Get the RGB values of the cluster centers (dominant colors)
    dominant_rgb_colors = kmeans.cluster_centers_.astype(int)

    # Convert RGB values to their closest CSS3 color names
    color_names = []
    for rgb in dominant_rgb_colors:
        try:
            color_name = get_closest_color_name(tuple(rgb))
            color_names.append(color_name)
        except Exception as e:
            print(f"Error naming detected color {rgb}: {e}")
            color_names.append("Unknown Color")
            
    return color_names

@app.get("/")
async def read_root():
    return {"message": "Image Captioning API is running!"}


@app.post("/upload_image")
async def upload_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    try:
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data)).convert("RGB")

        detected_colors = get_dominant_colors(image, num_colors=5) 
        
        # Construct a prompt that hints at multiple colors, if available
        color_hint = ""
        if detected_colors:
            color_hint = f" with colors like {', '.join(detected_colors[:3])}"
            
        text_prompt = f"A photo of a scene{color_hint}." 

        inputs = processor(images=image, text=text_prompt, return_tensors="pt").to(device)

        out = model.generate(
            **inputs, 
            max_length=100, 
            do_sample=True, 
            top_k=50, 
            top_p=0.80, 
            temperature=0.9,
            no_repeat_ngram_size=3 
            )
        caption = processor.decode(out[0], skip_special_tokens=True)

        # Basic cleanup: remove the initial "a photo of" type prefixes
        if caption.lower().startswith("a photo of, "):
            caption = caption[len("a photo of, "):].strip()
        elif caption.lower().startswith("a photo of "):
            caption = caption[len("a photo of "):].strip()
        elif caption.lower().startswith("a photo of"):
            caption = caption[len("a photo of"):].strip()
        
        if caption:
            caption = caption[0].upper() + caption[1:]

        return JSONResponse(content={"caption": caption, "detected_colors": detected_colors})

    except Exception as e:
        print(f"Error processing image: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing image: {e}")
    