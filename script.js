// script.js

// GitHub Configuration (Replace with your actual values)
const GITHUB_CONFIG = {
    owner: 'KxleyStudios',        // Your GitHub username
    repo: 'studio-vega-storyboards',      // Repository name
    token: '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',           // Personal Access Token
    branch: 'main'                        // Branch to store files
};

// Access control
const MODERATOR_CODE = "<StudioVEGA23726J398H46GH98>";
let isModeratorAccess = false;

// Check moderator access
function checkAccess() {
    const codeInput = document.getElementById('accessCode');
    const statusDiv = document.getElementById('accessStatus');
    const viewSection = document.getElementById('viewSection');
    
    if (codeInput.value === MODERATOR_CODE) {
        isModeratorAccess = true;
        statusDiv.innerHTML = '✓ Moderator access granted';
        statusDiv.className = 'access-status success';
        viewSection.style.display = 'block';
        loadStoryboards();
    } else if (codeInput.value === '') {
        statusDiv.innerHTML = 'Enter code for moderator access';
        statusDiv.className = 'access-status';
        viewSection.style.display = 'none';
    } else {
        statusDiv.innerHTML = '✗ Invalid code';
        statusDiv.className = 'access-status error';
        viewSection.style.display = 'none';
    }
}

// In-memory storage for storyboards (since we can't use browser storage)
let storyboardsData = [];

// Upload form handler
document.getElementById('uploadForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const statusDiv = document.getElementById('uploadStatus');
    const form = e.target;
    
    // Get form data
    const storyboardName = document.getElementById('storyboardName').value;
    const sceneName = document.getElementById('sceneName').value;
    const projectName = document.getElementById('projectName').value;
    const zipFile = document.getElementById('zipFile').files[0];
    
    // Validate ZIP file
    if (!zipFile || !zipFile.name.toLowerCase().endsWith('.zip')) {
        showStatus(statusDiv, 'Please select a valid ZIP file', 'error');
        return;
    }
    
    try {
        showStatus(statusDiv, 'Processing ZIP file...', 'loading');
        
        // Read ZIP file and convert to base64
        const arrayBuffer = await zipFile.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // Create metadata
        const timestamp = new Date().toISOString();
        const storyboardId = `storyboard_${Date.now()}`;
        
        // Prepare data for GitHub
        const storyboardData = {
            id: storyboardId,
            name: storyboardName,
            scene: sceneName,
            project: projectName,
            fileName: zipFile.name,
            uploadTime: timestamp,
            fileSize: zipFile.size,
            files: {}
        };
        
        // Extract all files from ZIP
        showStatus(statusDiv, 'Extracting files...', 'loading');
        for (const [filename, file] of Object.entries(zip.files)) {
            if (!file.dir) {
                try {
                    const content = await file.async('base64');
                    storyboardData.files[filename] = {
                        content: content,
                        type: getFileType(filename)
                    };
                } catch (err) {
                    console.warn(`Could not extract file: ${filename}`, err);
                }
            }
        }
        
        // Upload to GitHub
        showStatus(statusDiv, 'Uploading to GitHub...', 'loading');
        await uploadToGitHub(storyboardData);
        
        // Store in memory for current session
        storyboardsData.push(storyboardData);
        
        showStatus(statusDiv, 'Storyboard uploaded successfully!', 'success');
        form.reset();
        
        // Refresh moderator view if active
        if (isModeratorAccess) {
            loadStoryboards();
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        showStatus(statusDiv, 'Upload failed. Please check your connection and try again.', 'error');
    }
});

// Upload to GitHub repository
async function uploadToGitHub(storyboardData) {
    const path = `storyboards/${storyboardData.id}.json`;
    const content = btoa(JSON.stringify(storyboardData, null, 2));
    
    const response = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${GITHUB_CONFIG.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: `Add storyboard: ${storyboardData.name}`,
            content: content,
            branch: GITHUB_CONFIG.branch
        })
    });
    
    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
    }
    
    return response.json();
}

// Load all storyboards from GitHub
async function loadStoryboardsFromGitHub() {
    try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/storyboards`, {
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
            }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                return []; // Directory doesn't exist yet
            }
            throw new Error(`GitHub API error: ${response.status}`);
        }
        
        const files = await response.json();
        const storyboards = [];
        
        for (const file of files) {
            if (file.name.endsWith('.json')) {
                const fileResponse = await fetch(file.download_url);
                const storyboardData = await fileResponse.json();
                storyboards.push(storyboardData);
            }
        }
        
        return storyboards.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));
        
    } catch (error) {
        console.error('Error loading from GitHub:', error);
        return storyboardsData; // Fallback to in-memory data
    }
}

// Load all storyboards for moderator view
async function loadStoryboards() {
    if (!isModeratorAccess) return;
    
    const listDiv = document.getElementById('storyboardsList');
    listDiv.innerHTML = '<div class="status-message loading">Loading storyboards...</div>';
    
    try {
        const storyboards = await loadStoryboardsFromGitHub();
        
        if (storyboards.length === 0) {
            listDiv.innerHTML = '<div class="status-message">No storyboards uploaded yet.</div>';
            return;
        }
        
        let html = '';
        storyboards.forEach(data => {
            const uploadTime = new Date(data.uploadTime).toLocaleString();
            
            html += `
                <div class="storyboard-item">
                    <div class="storyboard-info">
                        <h3>${escapeHtml(data.name)}</h3>
                        <p><strong>Scene:</strong> ${escapeHtml(data.scene)}</p>
                        <p><strong>Project:</strong> ${escapeHtml(data.project)}</p>
                        <p><strong>File:</strong> ${escapeHtml(data.fileName)}</p>
                        <p class="meta"><strong>Uploaded:</strong> ${uploadTime}</p>
                        <p class="meta"><strong>Size:</strong> ${formatFileSize(data.fileSize)}</p>
                        <p class="meta"><strong>Files:</strong> ${Object.keys(data.files || {}).length} files</p>
                    </div>
                    <div class="storyboard-actions">
                        <button onclick="downloadStoryboard('${data.id}')" 
                                class="btn-download">
                            Download ZIP
                        </button>
                        <button onclick="previewStoryboard('${data.id}')" 
                                class="btn-download" 
                                style="background: #17a2b8;">
                            Preview Files
                        </button>
                        <button onclick="deleteStoryboard('${data.id}')" 
                                class="btn-download" 
                                style="background: #dc3545;">
                            Delete
                        </button>
                    </div>
                </div>
            `;
        });
        
        listDiv.innerHTML = html;
        
        // Store in memory for quick access
        storyboardsData = storyboards;
        
    } catch (error) {
        console.error('Load error:', error);
        listDiv.innerHTML = '<div class="status-message error">Failed to load storyboards. Please try again.</div>';
    }
}

// Download storyboard as ZIP
async function downloadStoryboard(storyboardId) {
    if (!isModeratorAccess) return;
    
    try {
        const storyboard = storyboardsData.find(s => s.id === storyboardId);
        if (!storyboard) {
            alert('Storyboard not found');
            return;
        }
        
        // Create new ZIP file
        const zip = new JSZip();
        
        // Add all files to ZIP
        for (const [filename, fileData] of Object.entries(storyboard.files || {})) {
            zip.file(filename, fileData.content, { base64: true });
        }
        
        // Generate ZIP file
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        
        // Download ZIP file
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = storyboard.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Download error:', error);
        alert('Failed to download storyboard');
    }
}

// Preview storyboard files
function previewStoryboard(storyboardId) {
    if (!isModeratorAccess) return;
    
    const storyboard = storyboardsData.find(s => s.id === storyboardId);
    if (!storyboard) {
        alert('Storyboard not found');
        return;
    }
    
    const files = Object.keys(storyboard.files || {});
    const fileList = files.length > 0 ? files.join('\n• ') : 'No files found';
    
    alert(`Files in "${storyboard.name}":\n\n• ${fileList}`);
}

// Delete storyboard (moderator only)
async function deleteStoryboard(storyboardId) {
    if (!isModeratorAccess) return;
    
    if (!confirm('Are you sure you want to delete this storyboard? This action cannot be undone.')) {
        return;
    }
    
    try {
        const path = `storyboards/${storyboardId}.json`;
        
        // Get file SHA for deletion
        const fileResponse = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`, {
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
            }
        });
        
        if (!fileResponse.ok) {
            throw new Error('File not found on GitHub');
        }
        
        const fileData = await fileResponse.json();
        
        // Delete from GitHub
        const deleteResponse = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Delete storyboard: ${storyboardId}`,
                sha: fileData.sha,
                branch: GITHUB_CONFIG.branch
            })
        });
        
        if (!deleteResponse.ok) {
            throw new Error('Failed to delete from GitHub');
        }
        
        // Remove from memory
        storyboardsData = storyboardsData.filter(s => s.id !== storyboardId);
        
        // Reload the list
        loadStoryboards();
        
    } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete storyboard. Please try again.');
    }
}

// Utility functions
function showStatus(element, message, type) {
    element.innerHTML = message;
    element.className = `status-message ${type}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileType(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
    const videoTypes = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
    const audioTypes = ['mp3', 'wav', 'ogg', 'aac', 'flac'];
    
    if (imageTypes.includes(ext)) return 'image';
    if (videoTypes.includes(ext)) return 'video';
    if (audioTypes.includes(ext)) return 'audio';
    return 'file';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Studio VEGA Storyboard Hub initialized (GitHub Mode)');
    
    // Check if GitHub is configured
    if (GITHUB_CONFIG.owner === 'your-github-username' || GITHUB_CONFIG.token === 'your-github-token') {
        console.warn('GitHub configuration needed! Please update GITHUB_CONFIG in script.js');
    }
    
    // Check if there's a saved access code (optional feature)
    const savedCode = sessionStorage.getItem('moderatorAccess');
    if (savedCode === 'true') {
        document.getElementById('accessCode').value = MODERATOR_CODE;
        checkAccess();
    }
});

// Save moderator access in session (optional feature)
function saveModeratorAccess() {
    if (isModeratorAccess) {
        sessionStorage.setItem('moderatorAccess', 'true');
    }
}