// Global variables
let allEntries = [];
let filteredEntries = [];
let currentSearchTerm = '';
let currentLevelFilter = 'all';

// DOM elements
const entriesGrid = document.getElementById('entries-grid');
const searchInput = document.getElementById('search-input');
const levelFilter = document.getElementById('level-filter');
const clearBtn = document.getElementById('clear-btn');
const statsElement = document.getElementById('stats');
const loadingElement = document.getElementById('loading');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadData();
});

// Setup event listeners
function setupEventListeners() {
    searchInput.addEventListener('input', handleSearch);
    levelFilter.addEventListener('change', handleLevelFilter);
    clearBtn.addEventListener('click', clearFilters);
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            searchInput.focus();
        }
    });
}

// Load data from API
async function loadData() {
    try {
        showLoading();
        const response = await fetch('https://opensheet.elk.sh/1KsybjmDwy1IxoPE9GDvdTkIy8Bi3GxHrfjZcN75lAr4/REGISTER');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Raw data received:', data.length, 'items');
        
        // Parse the data
        allEntries = parseEntries(data);
        console.log('Parsed entries:', allEntries.length);
        
        // Initialize filters
        filteredEntries = [...allEntries];
        
        // Populate level filter options
        populateLevelFilter();
        
        // Display entries
        displayEntries();
        updateStats();
        hideLoading();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load data. Please try again later.');
        hideLoading();
    }
}

// Parse entries from raw data
function parseEntries(data) {
    const entries = [];
    
    // Find where actual entries start
    let startIndex = -1;
    for (let i = 0; i < data.length; i++) {
        if (data[i]?.undefined === 'ELIZABETH WARREN') {
            startIndex = i;
            break;
        }
    }
    
    if (startIndex === -1) {
        console.log('Could not find start of entries');
        return [];
    }
    
    console.log('Starting to parse from index:', startIndex);
    
    // Process entries more dynamically - look for name patterns
    for (let i = startIndex; i < data.length; i++) {
        const currentRow = data[i];
        
        if (!currentRow?.undefined) continue;
        
        const currentValue = currentRow.undefined.trim();
        
        // Check if this looks like a valid person name
        if (isValidPersonName(currentValue)) {
            console.log('Found potential name:', currentValue);
            
            // Look for the associated data in the next few rows
            const entry = {
                name: currentValue,
                xAccount: '',
                offense: '',
                screenshot: '',
                level: '',
                id: generateId(currentValue)
            };
            
            // Search the next 6 rows for X account, offense, and level
            for (let j = i + 1; j < Math.min(i + 7, data.length); j++) {
                if (!data[j]?.undefined) continue;
                
                const nextValue = data[j].undefined.trim();
                
                if (nextValue.startsWith('https://x.com/') || nextValue.startsWith('https://twitter.com/')) {
                    // Check if this is a profile URL or a status URL
                    if (nextValue.includes('/status/')) {
                        entry.offense = nextValue;
                    } else {
                        entry.xAccount = nextValue;
                    }
                } else if (nextValue.startsWith('https://') && !entry.offense) {
                    entry.offense = nextValue;
                } else if (nextValue === 'HERE' || nextValue === 'VIDEO') {
                    entry.screenshot = nextValue;
                } else if (isLevelData(nextValue)) {
                    entry.level = nextValue;
                    break; // Level is usually the last field
                }
            }
            
            entries.push(entry);
            console.log('Added entry:', entry);
        }
    }
    
    return entries;
}

// Helper function to check if a string looks like a valid person name
function isValidPersonName(name) {
    if (!name || name.length < 2 || name.length > 50) return false;
    
    // Exclude obvious non-names
    const excludePatterns = [
        'TDS', 'MDS', 'EXTREME', 'HIGH', 'MILD', 'MULTIPLE OFFENSES',
        'ON SPECTRUM', 'HERE', 'VIDEO', 'NAME', 'X ACCOUNT', 'OFFENSE',
        'SCREENSHOT', 'RETARD LEVEL', 'MURDERER'
    ];
    
    const upperName = name.toUpperCase();
    if (excludePatterns.some(pattern => upperName.includes(pattern))) {
        return false;
    }
    
    // Must contain at least one space or hyphen (for compound names)
    if (!name.includes(' ') && !name.includes('-')) return false;
    
    // Should not start with https://
    if (name.startsWith('https://')) return false;
    
    // Should not be mostly numbers
    const numbersCount = (name.match(/\d/g) || []).length;
    if (numbersCount > name.length / 2) return false;
    
    return true;
}

// Helper function to check if a string looks like level data
function isLevelData(text) {
    if (!text) return false;
    
    const levelKeywords = ['TDS', 'MDS', 'EXTREME', 'HIGH', 'MILD', 'MULTIPLE OFFENSES', 'ON SPECTRUM'];
    const upperText = text.toUpperCase();
    
    return levelKeywords.some(keyword => upperText.includes(keyword));
}

// Generate unique ID for entries
function generateId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

// Populate level filter dropdown
function populateLevelFilter() {
    const levels = new Set();
    
    allEntries.forEach(entry => {
        if (entry.level) {
            const levelParts = entry.level.split(',').map(l => l.trim());
            levelParts.forEach(level => {
                if (level) levels.add(level);
            });
        }
    });
    
    // Clear existing options (except "All")
    levelFilter.innerHTML = '<option value="all">All Levels</option>';
    
    // Add level options
    Array.from(levels).sort().forEach(level => {
        const option = document.createElement('option');
        option.value = level;
        option.textContent = level;
        levelFilter.appendChild(option);
    });
}

// Handle search input
function handleSearch() {
    currentSearchTerm = searchInput.value.toLowerCase().trim();
    applyFilters();
}

// Handle level filter change
function handleLevelFilter() {
    currentLevelFilter = levelFilter.value;
    applyFilters();
}

// Apply all filters
function applyFilters() {
    filteredEntries = allEntries.filter(entry => {
        // Search filter
        const matchesSearch = !currentSearchTerm || 
            entry.name.toLowerCase().includes(currentSearchTerm) ||
            entry.xAccount.toLowerCase().includes(currentSearchTerm) ||
            entry.offense.toLowerCase().includes(currentSearchTerm) ||
            entry.level.toLowerCase().includes(currentSearchTerm);
        
        // Level filter
        const matchesLevel = currentLevelFilter === 'all' || 
            entry.level.toLowerCase().includes(currentLevelFilter.toLowerCase());
        
        return matchesSearch && matchesLevel;
    });
    
    displayEntries();
    updateStats();
}

// Clear all filters
function clearFilters() {
    searchInput.value = '';
    levelFilter.value = 'all';
    currentSearchTerm = '';
    currentLevelFilter = 'all';
    filteredEntries = [...allEntries];
    displayEntries();
    updateStats();
}

// Display entries
function displayEntries() {
    if (filteredEntries.length === 0) {
        entriesGrid.innerHTML = '<div class="error-message">No entries found matching your criteria.</div>';
        return;
    }
    
    // Reverse the order so last entry shows first
    const reversedEntries = [...filteredEntries].reverse();
    entriesGrid.innerHTML = reversedEntries.map(entry => createEntryCard(entry)).join('');
}

// Create entry card HTML
function createEntryCard(entry) {
    const levelBadges = createLevelBadges(entry.level);
    const xButton = entry.xAccount ? createXButton(entry.xAccount) : '';
    const offenseLink = entry.offense ? createOffenseLink(entry.offense) : 'N/A';
    
    return `
        <div class="entry-card" data-id="${entry.id}">
            <div class="entry-header">
                <div class="entry-name">${escapeHtml(entry.name)}</div>
            </div>
            <div class="entry-body">
                <div class="entry-field">
                    <div class="field-label" style="display: flex; align-items: center;"><span style="font-size: 2.4em; font-weight: bold;">𝕏</span>:</div>
                    <div class="field-value">${xButton || 'N/A'}</div>
                </div>
                <div class="entry-field">
                    <div class="field-label">Offense:</div>
                    <div class="field-value">${offenseLink}</div>
                </div>
                ${entry.level ? `
                <div class="entry-field">
                    <div class="field-label">Retard Level:</div>
                    <div class="field-value">
                        <div class="level-badges">${levelBadges}</div>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

// Create level badges
function createLevelBadges(levelString) {
    if (!levelString) return '';
    
    const levels = levelString.split(',').map(l => l.trim()).filter(l => l);
    
    return levels.map(level => {
        const className = getLevelClassName(level);
        return `<span class="level-badge ${className}">${escapeHtml(level)}</span>`;
    }).join('');
}

// Get CSS class name for level
function getLevelClassName(level) {
    const levelLower = level.toLowerCase();
    
    if (levelLower.includes('tds')) return 'tds';
    if (levelLower.includes('mds')) return 'mds';
    if (levelLower.includes('extreme')) return 'extreme';
    if (levelLower.includes('high')) return 'high';
    if (levelLower.includes('mild')) return 'mild';
    if (levelLower.includes('spectrum')) return 'spectrum';
    if (levelLower.includes('multiple')) return 'multiple';
    
    return 'default';
}

// Create X button
function createXButton(xAccount) {
    if (!xAccount || xAccount === 'N/A' || xAccount === 'NO X ACCOUNT') {
        return '<span class="field-value">N/A</span>';
    }
    
    const url = xAccount.startsWith('http') ? xAccount : `https://x.com/${xAccount}`;
    
    return `
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="x-button">
            <span style="font-size: 16px; font-weight: bold;">𝕏</span>
            View Profile
        </a>
    `;
}

// Create offense link
function createOffenseLink(offense) {
    if (!offense || offense === 'N/A') {
        return 'N/A';
    }
    
    if (offense.startsWith('http')) {
        return `<a href="${escapeHtml(offense)}" target="_blank" rel="noopener noreferrer" class="offense-link">View Offense</a>`;
    }
    
    return escapeHtml(offense);
}

// Update stats display
function updateStats() {
    const total = allEntries.length;
    const filtered = filteredEntries.length;
    
    let statsText = `Showing ${filtered} of ${total} entries`;
    
    if (currentSearchTerm) {
        statsText += ` matching "${currentSearchTerm}"`;
    }
    
    if (currentLevelFilter !== 'all') {
        statsText += ` with level "${currentLevelFilter}"`;
    }
    
    statsElement.textContent = statsText;
}

// Show loading indicator
function showLoading() {
    loadingElement.style.display = 'block';
    entriesGrid.style.display = 'none';
}

// Hide loading indicator
function hideLoading() {
    loadingElement.style.display = 'none';
    entriesGrid.style.display = 'grid';
}

// Show error message
function showError(message) {
    entriesGrid.innerHTML = `<div class="error-message">${escapeHtml(message)}</div>`;
    entriesGrid.style.display = 'block';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export functions for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseEntries,
        createLevelBadges,
        getLevelClassName,
        escapeHtml
    };
} 