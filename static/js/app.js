// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const btnSpinner = document.getElementById('btn-spinner');
const btnLabel = document.getElementById('btn-label');
const totalCountEl = document.getElementById('total-count');
const featureCountEl = document.getElementById('feature-count');
const issueCountEl = document.getElementById('issue-count');
const searchInput = document.getElementById('search-input');
const typeFilter = document.getElementById('type-filter');

const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const emptyState = document.getElementById('empty-state');
const feedContent = document.getElementById('feed-content');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const tweetTextarea = document.getElementById('tweet-textarea');
const progressCircle = document.getElementById('progress-circle');
const charCountText = document.getElementById('char-count');
const closeModalBtn = document.getElementById('close-modal');
const cancelTweetBtn = document.getElementById('cancel-tweet-btn');
const shareTweetBtn = document.getElementById('share-tweet-btn');

// App State
let notesData = [];
const CIRCUMFERENCE = 2 * Math.PI * 12; // Radius is 12, so ~75.398

// Initialize SVG Progress circle
progressCircle.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;
progressCircle.style.strokeDashoffset = CIRCUMFERENCE;

// Fetch release notes from backend API
async function fetchReleaseNotes(forceRefresh = false) {
    showState('loading');
    refreshBtn.classList.add('loading');
    refreshBtn.disabled = true;

    try {
        const url = `/api/notes${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'error') {
            throw new Error(data.message);
        }
        
        notesData = data.notes || [];
        updateStats();
        renderFeed();
        
    } catch (error) {
        console.error('Error fetching release notes:', error);
        errorMessage.textContent = error.message || 'An error occurred while connecting to the backend server.';
        showState('error');
    } finally {
        refreshBtn.classList.remove('loading');
        refreshBtn.disabled = false;
    }
}

// Show UI States
function showState(state) {
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    emptyState.style.display = 'none';
    feedContent.style.display = 'none';

    if (state === 'loading') {
        loadingState.style.display = 'flex';
    } else if (state === 'error') {
        errorState.style.display = 'flex';
    } else if (state === 'empty') {
        emptyState.style.display = 'flex';
    } else if (state === 'feed') {
        feedContent.style.display = 'flex';
    }
}

// Calculate Stats
function updateStats() {
    let total = 0;
    let features = 0;
    let issues = 0;

    notesData.forEach(entry => {
        entry.items.forEach(item => {
            total++;
            const typeLower = item.type.toLowerCase();
            if (typeLower.includes('feature')) {
                features++;
            } else if (typeLower.includes('issue') || typeLower.includes('bug')) {
                issues++;
            }
        });
    });

    totalCountEl.textContent = total;
    featureCountEl.textContent = features;
    issueCountEl.textContent = issues;
}

// Filter and Render Feed
function renderFeed() {
    const searchQuery = searchInput.value.toLowerCase().trim();
    const typeValue = typeFilter.value;

    feedContent.innerHTML = '';
    let renderedItemsCount = 0;

    notesData.forEach(entry => {
        // Filter items within this entry
        const filteredItems = entry.items.filter(item => {
            // Type filtering
            const itemTypeLower = item.type.toLowerCase();
            let matchesType = true;
            
            if (typeValue === 'feature') {
                matchesType = itemTypeLower.includes('feature');
            } else if (typeValue === 'issue') {
                matchesType = itemTypeLower.includes('issue') || itemTypeLower.includes('bug');
            } else if (typeValue === 'deprecation') {
                matchesType = itemTypeLower.includes('deprecation') || itemTypeLower.includes('disable');
            } else if (typeValue === 'update') {
                // Any other update type
                matchesType = !itemTypeLower.includes('feature') && 
                              !itemTypeLower.includes('issue') && 
                              !itemTypeLower.includes('bug') && 
                              !itemTypeLower.includes('deprecation') && 
                              !itemTypeLower.includes('disable');
            }

            // Search query filtering
            let matchesSearch = true;
            if (searchQuery) {
                const searchText = `${entry.date} ${item.type} ${item.description_text}`.toLowerCase();
                matchesSearch = searchText.includes(searchQuery);
            }

            return matchesType && matchesSearch;
        });

        if (filteredItems.length > 0) {
            renderedItemsCount += filteredItems.length;

            // Create Group Section for this date
            const groupSection = document.createElement('div');
            groupSection.className = 'date-group';

            const header = document.createElement('h2');
            header.className = 'date-header';
            header.textContent = entry.date;
            groupSection.appendChild(header);

            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'date-cards';

            filteredItems.forEach((item, index) => {
                const card = document.createElement('div');
                card.className = 'note-card';

                const cardHeader = document.createElement('div');
                cardHeader.className = 'card-header';

                const badgeAndMeta = document.createElement('div');
                badgeAndMeta.className = 'badge-and-meta';

                // Assign badge classes based on item type
                const badge = document.createElement('span');
                const typeLower = item.type.toLowerCase();
                let badgeClass = 'update';
                if (typeLower.includes('feature')) {
                    badgeClass = 'feature';
                } else if (typeLower.includes('issue') || typeLower.includes('bug')) {
                    badgeClass = 'issue';
                } else if (typeLower.includes('deprecation') || typeLower.includes('disable')) {
                    badgeClass = 'deprecation';
                }
                badge.className = `badge ${badgeClass}`;
                badge.textContent = item.type;
                badgeAndMeta.appendChild(badge);

                // Source Link
                if (entry.link) {
                    const sourceLink = document.createElement('a');
                    sourceLink.className = 'source-link';
                    // Deep link if hash available, otherwise standard feed link
                    // The feed ID often has format: tag:google.com,2016:bigquery-release-notes#June_15_2026
                    const hashParts = entry.id.split('#');
                    const hash = hashParts.length > 1 ? `#${hashParts[1]}` : '';
                    sourceLink.href = entry.link + hash;
                    sourceLink.target = '_blank';
                    sourceLink.innerHTML = `
                        <span>Docs</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    `;
                    badgeAndMeta.appendChild(sourceLink);
                }

                cardHeader.appendChild(badgeAndMeta);

                // Tweet Button
                const tweetBtn = document.createElement('button');
                tweetBtn.className = 'tweet-btn';
                tweetBtn.innerHTML = `
                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span>Tweet</span>
                `;
                tweetBtn.addEventListener('click', () => openTweetModal(entry, item));
                
                cardHeader.appendChild(tweetBtn);
                card.appendChild(cardHeader);

                // Card Content (HTML format)
                const cardContent = document.createElement('div');
                cardContent.className = 'card-content';
                cardContent.innerHTML = item.description_html;
                card.appendChild(cardContent);

                cardsContainer.appendChild(card);
            });

            groupSection.appendChild(cardsContainer);
            feedContent.appendChild(groupSection);
        }
    });

    if (renderedItemsCount === 0) {
        showState('empty');
    } else {
        showState('feed');
    }
}

// Calculate Twitter Char Length precisely
// Twitter URLs count as 23 characters under standard t.co shortening.
function getTwitterTextLength(str) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    let length = str.length;
    const urls = str.match(urlRegex);
    
    if (urls) {
        urls.forEach(url => {
            length = length - url.length + 23;
        });
    }
    return length;
}

// Open Tweet Composer Modal
function openTweetModal(entry, item) {
    const noteDate = entry.date;
    const noteType = item.type;
    const noteText = item.description_text;
    
    // Construct default deep link
    const hashParts = entry.id.split('#');
    const hash = hashParts.length > 1 ? `#${hashParts[1]}` : '';
    const noteLink = entry.link ? (entry.link + hash) : 'https://docs.cloud.google.com/bigquery/docs/release-notes';
    
    const hashtags = "#BigQuery #GoogleCloud";
    const prefix = `BigQuery ${noteType} (${noteDate}): `;
    
    // Format smart default draft text to fit within Twitter's 280 constraint
    // Max description characters = 280 - 23 (link) - 22 (hashtags) - prefix.length - 6 (extra spaces + ellipsis)
    const maxDescLength = 280 - 23 - 22 - prefix.length - 6;
    
    let displayDesc = noteText;
    if (noteText.length > maxDescLength) {
        displayDesc = noteText.substring(0, maxDescLength).trim() + "...";
    }
    
    const defaultTweet = `${prefix}${displayDesc}\n\n${noteLink}\n${hashtags}`;
    
    tweetTextarea.value = defaultTweet;
    updateTweetProgress();
    
    tweetModal.classList.add('active');
    tweetTextarea.focus();
}

// Close Tweet Modal
function closeTweetModal() {
    tweetModal.classList.remove('active');
    tweetTextarea.value = '';
}

// Update Twitter character length progress circle & text
function updateTweetProgress() {
    const text = tweetTextarea.value;
    const currentLen = getTwitterTextLength(text);
    const maxLen = 280;
    const remaining = maxLen - currentLen;
    
    charCountText.textContent = remaining;
    
    // CSS Class styles based on warning thresholds
    charCountText.className = 'char-count-text';
    if (remaining <= 0) {
        charCountText.classList.add('danger');
        shareTweetBtn.disabled = true;
        shareTweetBtn.style.opacity = 0.5;
        shareTweetBtn.style.cursor = 'not-allowed';
    } else {
        shareTweetBtn.disabled = false;
        shareTweetBtn.style.opacity = 1;
        shareTweetBtn.style.cursor = 'pointer';
        if (remaining <= 20) {
            charCountText.classList.add('warning');
        }
    }
    
    // Update SVG Progress ring
    const percentage = Math.min(currentLen / maxLen, 1);
    const offset = CIRCUMFERENCE - (percentage * CIRCUMFERENCE);
    progressCircle.style.strokeDashoffset = offset;
    
    // Progress Circle color highlights
    if (remaining <= 0) {
        progressCircle.style.stroke = 'var(--accent-rose)';
    } else if (remaining <= 20) {
        progressCircle.style.stroke = 'var(--accent-amber)';
    } else {
        progressCircle.style.stroke = 'var(--primary-light)';
    }
}

// Action: Post Tweet
function shareTweet() {
    const text = tweetTextarea.value;
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterIntentUrl, '_blank');
    closeTweetModal();
}

// Event Listeners
refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
retryBtn.addEventListener('click', () => fetchReleaseNotes(true));
searchInput.addEventListener('input', renderFeed);
typeFilter.addEventListener('change', renderFeed);

closeModalBtn.addEventListener('click', closeTweetModal);
cancelTweetBtn.addEventListener('click', closeTweetModal);
shareTweetBtn.addEventListener('click', shareTweet);
tweetTextarea.addEventListener('input', updateTweetProgress);

// Close modal when clicking outside container
tweetModal.addEventListener('click', (e) => {
    if (e.target === tweetModal) {
        closeTweetModal();
    }
});

// ESC key to close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && tweetModal.classList.contains('active')) {
        closeTweetModal();
    }
});

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes(false);
});
