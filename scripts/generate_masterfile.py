import os
import json
from pathlib import Path
from datetime import datetime

MEDIA_DIR = Path(__file__).parent.parent / "media"
OUTPUT_FILE = Path(__file__).parent.parent / "masterfile.json"
MASTER_SONG_FILE = Path(__file__).parent.parent / "MasterSongPages.json"
SUBTITLE_EXTS = {'.srt', '.vtt', '.sbv', '.ass'}
IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}
TYPE_MAP = {
    '.mp4': 'video',
    '.mov': 'video',
    '.mkv': 'video',
    '.mp3': 'audio',
    '.ogg': 'audio',
    '.m4a': 'audio',
    '.wav': 'audio',
    '.pdf': 'document',
    '.txt': 'document',
    '.docx': 'document',
    '.json': 'document'
}

def normalize_display_name(name):
    return name.replace('-', ' ').replace('_', ' ').strip()

def slugify(name):
    return normalize_display_name(name).lower().replace(' ', '-') or f"file-{int(datetime.now().timestamp())}"

def infer_tags(file_name, ext):
    tokens = normalize_display_name(file_name).lower().split()
    unique = set(tokens + [ext.replace('.', '')])
    return sorted(list(unique))

def map_type(ext):
    if ext in TYPE_MAP:
        return TYPE_MAP[ext]
    if ext in SUBTITLE_EXTS:
        return 'subtitle'
    if ext in IMAGE_EXTS:
        return 'image'
    return 'file'

def load_master_song_metadata():
    """Load comments and notes from MasterSongPages.json"""
    if not MASTER_SONG_FILE.exists():
        return {}
    
    try:
        with open(MASTER_SONG_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        metadata = {}
        for song in data.get('songs', []):
            # Extract from lives
            for live in song.get('lives', []):
                src = live.get('src', '')
                if src:
                    filename = Path(src).name
                    metadata[filename.lower()] = {
                        'notes': live.get('notes', live.get('note', '')),
                        'title': live.get('title', ''),
                        'tags': []
                    }
            
            # Extract from instruments
            for inst in song.get('instruments', []):
                src = inst.get('src', '')
                if src:
                    filename = Path(src).name
                    metadata[filename.lower()] = {
                        'notes': inst.get('notes', inst.get('note', '')),
                        'title': inst.get('title', ''),
                        'tags': []
                    }
        
        return metadata
    except Exception as e:
        print(f"Warning: Could not load MasterSongPages.json: {e}")
        return {}

def main():
    if not MEDIA_DIR.exists():
        print(f"Error: {MEDIA_DIR} does not exist")
        return

    # Load existing metadata from MasterSongPages.json
    master_metadata = load_master_song_metadata()

    all_files = [f for f in MEDIA_DIR.iterdir() if f.is_file()]
    
    # Group subtitles and images by base name
    subtitle_grouping = {}
    image_lookup = {}
    
    for file in all_files:
        ext = file.suffix.lower()
        base = file.stem.lower()
        
        if ext in SUBTITLE_EXTS:
            if base not in subtitle_grouping:
                subtitle_grouping[base] = []
            subtitle_grouping[base].append(f"media/{file.name}")
        
        if ext in IMAGE_EXTS:
            image_lookup[base] = f"media/{file.name}"
    
    # Build file entries
    file_entries = []
    for file in all_files:
        ext = file.suffix.lower()
        base = file.stem.lower()
        stats = file.stat()
        
        # Check if we have metadata from MasterSongPages.json
        filename_lower = file.name.lower()
        merged_meta = master_metadata.get(filename_lower, {})
        
        entry = {
            "id": slugify(file.stem),
            "name": file.name,
            "display_name": normalize_display_name(file.stem),
            "path": f"media/{file.name}",
            "extension": ext.replace('.', ''),
            "type": map_type(ext),
            "notes": merged_meta.get('notes', ''),
            "added": datetime.fromtimestamp(stats.st_mtime).isoformat(),
            "subtitles": subtitle_grouping.get(base, []),
            "image": image_lookup.get(base, ""),
            "tags": infer_tags(file.stem, ext)
        }
        file_entries.append(entry)
    
    # Sort by display name
    file_entries.sort(key=lambda x: x['display_name'].lower())
    
    # Write output
    output = {
        "generatedAt": datetime.now().isoformat(),
        "files": file_entries
    }
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        f.write('\n')
    
    print(f"masterfile.json updated with {len(file_entries)} items.")
    if master_metadata:
        print(f"Merged metadata from MasterSongPages.json for {len(master_metadata)} files.")

if __name__ == "__main__":
    main()