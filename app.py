import os
import time
import requests
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request
from bs4 import BeautifulSoup

app = Flask(__name__)

# Cache configuration
CACHE_EXPIRY_SECONDS = 600  # 10 minutes
feed_cache = {
    "data": None,
    "last_fetched": 0
}

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_release_notes():
    """Fetches the XML feed and parses it into structured JSON."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    response = requests.get(FEED_URL, headers=headers)
    response.raise_for_status()
    
    # Atom feed namespace
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    root = ET.fromstring(response.content)
    
    entries = []
    
    for entry in root.findall('atom:entry', ns):
        title_elem = entry.find('atom:title', ns)
        date_str = title_elem.text if title_elem is not None else "Unknown Date"
        
        updated_elem = entry.find('atom:updated', ns)
        updated_str = updated_elem.text if updated_elem is not None else ""
        
        id_elem = entry.find('atom:id', ns)
        entry_id = id_elem.text if id_elem is not None else ""
        
        link_elem = entry.find('atom:link[@rel="alternate"]', ns)
        link = link_elem.attrib.get('href') if link_elem is not None else ""
        
        content_elem = entry.find('atom:content', ns)
        content_html = content_elem.text if content_elem is not None else ""
        
        # Parse content HTML to split into individual updates
        soup = BeautifulSoup(content_html, 'html.parser')
        
        items = []
        current_type = None
        current_content_parts = []
        
        # Iterate through HTML elements to group by h3 tags
        for child in soup.contents:
            if child.name == 'h3':
                # Save previous item if we were tracking one
                if current_type or current_content_parts:
                    desc_html = "".join(str(c) for c in current_content_parts).strip()
                    desc_text = BeautifulSoup(desc_html, 'html.parser').get_text(separator=' ').strip()
                    items.append({
                        'type': current_type or 'Update',
                        'description_html': desc_html,
                        'description_text': desc_text
                    })
                current_type = child.get_text().strip()
                current_content_parts = []
            else:
                current_content_parts.append(child)
                
        # Save the final item
        if current_type or current_content_parts:
            desc_html = "".join(str(c) for c in current_content_parts).strip()
            desc_text = BeautifulSoup(desc_html, 'html.parser').get_text(separator=' ').strip()
            items.append({
                'type': current_type or 'Update',
                'description_html': desc_html,
                'description_text': desc_text
            })
            
        # Fallback if no h3 elements were found
        if not items:
            desc_text = soup.get_text(separator=' ').strip()
            items.append({
                'type': 'Update',
                'description_html': content_html,
                'description_text': desc_text
            })
            
        entries.append({
            'date': date_str,
            'updated': updated_str,
            'id': entry_id,
            'link': link,
            'items': items
        })
        
    return entries

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def get_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = time.time()
    
    if force_refresh or not feed_cache["data"] or (now - feed_cache["last_fetched"] > CACHE_EXPIRY_SECONDS):
        try:
            data = parse_release_notes()
            feed_cache["data"] = data
            feed_cache["last_fetched"] = now
            return jsonify({
                "status": "success",
                "source": "live",
                "notes": data
            })
        except Exception as e:
            # Fall back to cache if live fetch fails, otherwise return error
            if feed_cache["data"]:
                return jsonify({
                    "status": "partial_success",
                    "source": "cache_fallback",
                    "error": str(e),
                    "notes": feed_cache["data"]
                })
            return jsonify({
                "status": "error",
                "message": f"Failed to fetch release notes: {str(e)}"
            }), 500
    else:
        return jsonify({
            "status": "success",
            "source": "cache",
            "notes": feed_cache["data"]
        })

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
