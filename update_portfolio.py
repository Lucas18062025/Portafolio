import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the CSS for the contact buttons so they KEEP their original colors
# We'll inject these new classes into the style block.
btn_styles = """
        .btn-linkedin { border-color: #00c8ff; color: #00c8ff; }
        .btn-linkedin::before { background: #00c8ff; }
        .btn-linkedin:hover { color: #000; box-shadow: 0 0 20px rgba(0, 200, 255, 0.3); }

        .btn-whatsapp { border-color: #00ff88; color: #00ff88; }
        .btn-whatsapp::before { background: #00ff88; }
        .btn-whatsapp:hover { color: #000; box-shadow: 0 0 20px rgba(0, 255, 136, 0.3); }

        .btn-email { border-color: #00c8ff; color: #00c8ff; }
        .btn-email::before { background: #00c8ff; }
        .btn-email:hover { color: #000; box-shadow: 0 0 20px rgba(0, 200, 255, 0.3); }
"""
content = re.sub(r'(\.btn-gmail \{)', btn_styles + r'\1', content)

# 2. Update the HTML to USE these new classes
content = re.sub(r'class="btn btn-b"([^>]+LINKEDIN)', r'class="btn btn-linkedin"\1', content)
content = re.sub(r'class="btn"([^>]+WHATSAPP)', r'class="btn btn-whatsapp"\1', content)
content = re.sub(r'class="btn btn-b"([^>]+EMAIL)', r'class="btn btn-email"\1', content)

# 3. Perform the global palette replacement everywhere else
# Save the original CONECTAR section aside temporarily? Or maybe it's fine
# since the colors in the CONECTAR section are what we injected, but the global replace might hit them.
# The user explicitly asked to conserve original colors.

# Let's perform a careful color map replacement.
# But wait! If I just globally replace #00ff88, it will ruin the .btn-whatsapp I just added above!
# So, instead of a global string replace, let's just replace the CSS variables, inline styles, SVGs, and Canvas in a controlled manner.

replacements = {
    # CSS Variables
    ": #020408;": ": #0d1117;", 
    ": #080f16;": ": #161b22;",
    ": #0a1520;": ": #21262d;",
    ": #00ff88;": ": #4493f8;",   # accent
    ": #00c8ff;": ": #abb4bf;",   # accent2
    ": #7b2fff;": ": #8b949e;",   # accent3
    ": #d0e8f0;": ": #c9d1d9;", 
    ": #6a8fa8;": ": #8b949e;",
    ": #0f2030;": ": #30363d;",
    ": #1a3a50;": ": #484f58;",
    "rgba(0, 255, 136,": "rgba(68, 147, 248,",
    
    # Specific elements
    "#b088ff": "#c9d1d9",
    "rgba(0,255,136,": "rgba(68,147,248,",
    "rgba(0,200,255,": "rgba(171,180,191,",
    "rgba(123,47,255,": "rgba(139,148,158,",
    "rgba(123, 47, 255,": "rgba(139,148,158,",
    "rgba(0,200,80,": "rgba(68,147,248,",
    
    # SVGs and inline hardcoded colors
    "fill=\\"#00ff88\\"": "fill=\\"#4493f8\\"",
    "stroke=\\"#00ff88\\"": "stroke=\\"#4493f8\\"",
    "fill=\\"#00c8ff\\"": "fill=\\"#abb4bf\\"",
    "stroke=\\"#00c8ff\\"": "stroke=\\"#abb4bf\\"",
    "fill=\\"#7b2fff\\"": "fill=\\"#8b949e\\"",
    "stroke=\\"#7b2fff\\"": "stroke=\\"#8b949e\\"",
    
    # Canvas
    "['#00ff88', '#00c8ff', '#7b2fff']": "['#4493f8', '#abb4bf', '#8b949e']",
    
    # Terminal backgrounds (to fit new style)
    "background: #040d14;": "background: #0d1117;",
    "linear-gradient(90deg, #0a1a28, #0d2035)": "linear-gradient(90deg, #161b22, #21262d)",
    "background: #020a10;": "background: #0d1117;",
    "background: #030b12;": "background: #0d1117;",
}

for old, new in replacements.items():
    content = content.replace(old, new)


with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updates applied.")
