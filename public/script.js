
const urlInput = document.getElementById('urlInput');
const bypassBtn = document.getElementById('bypassBtn');
const clipboardBtn = document.getElementById('clipboardBtn');
const resultModal = document.getElementById('resultModal');
const errorModal = document.getElementById('errorModal');
const resolvedUrl = document.getElementById('resolvedUrl');
const openLinkBtn = document.getElementById('openLinkBtn');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const newLinkBtn = document.getElementById('newLinkBtn');
const backHomeBtn = document.getElementById('backHomeBtn');


let isAutoRedirectEnabled = false;
let progressInterval;
let lastResolvedUrl = '';

document.addEventListener('DOMContentLoaded', function() {
    urlInput.value = '';
    urlInput.focus();
    
    const savedAutoRedirect = localStorage.getItem('autoRedirect');
    
    if (savedAutoRedirect === 'true') {
        isAutoRedirectEnabled = true;
        document.querySelector('.switch').classList.add('active');
    } else {
        isAutoRedirectEnabled = false;
        localStorage.setItem('autoRedirect', 'false');
    }
    
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    initializeFAQ();
    initializeScrollAnimations();
});


function detectSite(url) {
    if (!url) return null;
    
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('shr2.link')) {
        return 'shr2link';
    }
    
    if (urlLower.includes('yorurl.com')) return 'yorurl';
    if (urlLower.includes('linkjust.com')) return 'linkjust';
    if (urlLower.includes('just2earn.com')) return 'just2earn';
    if (urlLower.includes('nitro-link.com')) return 'nitro-link';
    
    return null;
}

async function processLink() {
    const url = urlInput.value.trim();
    
    if (!url) {
        showError('Please enter a valid URL to get started');
        return;
    }

    if (!/^https?:\/\//i.test(url)) {
        showError('Please enter a valid URL starting with http:// or https://');
        return;
    }

    const site = detectSite(url);
    
    if (!site) {
        showErrorWithSupportedHint('This website is not currently supported');
        return;
    }

    startLoadingAnimation();

    try {
        const urlPath = extractUrlPath(url);
        
        updateProgressStatus('Connecting to server...', 20);
        
        const response = await fetch('/api/bypass', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                site: site,
                urlPath: urlPath
            })
        });

        updateProgressStatus('Processing website...', 60);
        
        const result = await response.json();
        
        updateProgressStatus('Finalizing...', 90);
        
        if (result.success) {
            updateProgressStatus('Completed!', 100);
            
            setTimeout(() => {
                resolvedUrl.textContent = result.downloadUrl;
                lastResolvedUrl = result.downloadUrl;
                showResultModal(result);
                
                if (isAutoRedirectEnabled && result.downloadUrl) {
                    setTimeout(() => {
                        performAutoRedirect(result.downloadUrl);
                    }, 1500);
                }
            }, 500);
            
        } else {
            showError(result.error || 'Failed to bypass the link');
        }
        
    } catch (error) {
        showError('An error occurred - please try again');
    } finally {
        stopLoadingAnimation();
    }
}

function performAutoRedirect(url) {
    if (!url) return;
    
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
        iosAutoRedirect(url);
    } else {
        window.open(url, '_blank');
    }
}

function iosAutoRedirect(url) {
    const tempButton = document.createElement('button');
    tempButton.innerHTML = 'Open Link';
    tempButton.style.position = 'fixed';
    tempButton.style.top = '0';
    tempButton.style.left = '0';
    tempButton.style.width = '100%';
    tempButton.style.height = '100%';
    tempButton.style.opacity = '0.01';
    tempButton.style.background = 'transparent';
    tempButton.style.border = 'none';
    tempButton.style.zIndex = '10000';
    tempButton.style.cursor = 'pointer';
    
    document.body.appendChild(tempButton);
    
    tempButton.onclick = function() {
        window.location.href = url;
        setTimeout(() => {
            if (document.body.contains(tempButton)) {
                document.body.removeChild(tempButton);
            }
        }, 1000);
    };
    
    setTimeout(() => {
        try {
            tempButton.click();
        } catch (error) {
            window.location.href = url;
        }
    }, 100);
    
    setTimeout(() => {
        if (document.body.contains(tempButton)) {
            document.body.removeChild(tempButton);
            window.location.href = url;
        }
    }, 2000);
}

function openLink() {
    const url = resolvedUrl.textContent || lastResolvedUrl;
    if (url && url.startsWith('http')) {
        performAutoRedirect(url);
    }
}

function showResultModal(result) {
    resolvedUrl.textContent = result.downloadUrl;
    lastResolvedUrl = result.downloadUrl;
    
    showModal(resultModal);
}

function showErrorWithSupportedHint(message) {
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.innerHTML = `
        ${message}
        <div class="supported-hint">
            <div class="epic-svg-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 15l6 -6"></path>
                    <path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464"></path>
                    <path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463"></path>
                </svg>
            </div>
            <span class="hint-text">Check supported websites down below</span>
        </div>
    `;
    
    document.getElementById('errorModal').classList.add('show');
}

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    document.getElementById('errorModal').classList.add('show');
}

function startLoadingAnimation() {
    bypassBtn.innerHTML = `
        <div class="loading-spinner"></div>
        <span>Processing...</span>
        <div class="progress-container">
            <div class="progress-bar" id="progressBar"></div>
        </div>
    `;
    bypassBtn.disabled = true;
    bypassBtn.classList.add('loading');
    
    if (!document.querySelector('.status-text')) {
        const statusText = document.createElement('div');
        statusText.className = 'status-text';
        statusText.id = 'statusText';
        statusText.textContent = 'Initializing...';
        bypassBtn.parentNode.insertBefore(statusText, bypassBtn.nextSibling);
    }
    
    document.getElementById('statusText').style.display = 'block';
    
    let progress = 0;
    const progressBar = document.getElementById('progressBar');
    progressInterval = setInterval(() => {
        progress += 2;
        if (progress < 90) {
            progressBar.style.width = `${progress}%`;
        }
    }, 200);
}

function updateProgressStatus(message, progressPercent) {
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');
    
    if (statusText) {
        statusText.textContent = message;
    }
    
    if (progressBar && progressPercent) {
        progressBar.style.width = `${progressPercent}%`;
        
        if (progressPercent >= 80) {
            progressBar.style.background = 'linear-gradient(90deg, #00ff26, #00ff88)';
        } else if (progressPercent >= 50) {
            progressBar.style.background = 'linear-gradient(90deg, #ffcc00, #ffaa00)';
        }
    }
}

function stopLoadingAnimation() {
    clearInterval(progressInterval);
    
    setTimeout(() => {
        bypassBtn.innerHTML = 'Bypass Link !';
        bypassBtn.disabled = false;
        bypassBtn.classList.remove('loading');
        
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.style.display = 'none';
        }
    }, 500);
}

function extractUrlPath(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.pathname.replace(/^\//, '') + urlObj.search;
    } catch (error) {
        return url.replace(/^https?:\/\/[^\/]+\//, '').replace(/^\//, '');
    }
}

function showModal(modal) {
    modal.classList.add('show');
}

function hideModal(modal) {
    modal.classList.remove('show');
}

function copyToClipboard() {
    const text = resolvedUrl.textContent;
    navigator.clipboard.writeText(text).then(() => {
        copyLinkBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyLinkBtn.textContent = 'Copy Link';
        }, 2000);
    });
}

async function checkClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        if (text && (text.includes('http://') || text.includes('https://'))) {
            urlInput.value = text;
            urlInput.focus();
            
            const originalHTML = clipboardBtn.innerHTML;
            clipboardBtn.innerHTML = '✓ Pasted!';
            clipboardBtn.style.background = 'rgba(0, 255, 38, 0.1)';
            clipboardBtn.style.borderColor = '#00ff26';
            clipboardBtn.style.color = '#00ff26';
            
            setTimeout(() => {
                clipboardBtn.innerHTML = originalHTML;
                clipboardBtn.style.background = 'transparent';
                clipboardBtn.style.borderColor = '#d111b8';
                clipboardBtn.style.color = '#d111b8';
            }, 2000);
        }
    } catch (error) {
        showError('Cannot access clipboard. Please paste manually.');
    }
}

function initializeFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', (e) => {
            if (isIOS) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            faqItems.forEach(otherItem => {
                if (otherItem !== item && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });
            
            item.classList.toggle('active');
            
            if (!isIOS) {
                item.style.animation = 'none';
                setTimeout(() => {
                    item.style.animation = 'faqBounce 0.3s ease';
                }, 10);
            }
        });
        
        if (!isIOS) {
            item.addEventListener('mouseenter', () => {
                if (!item.classList.contains('active')) {
                    item.style.transform = 'translateY(-2px)';
                }
            });
            
            item.addEventListener('mouseleave', () => {
                if (!item.classList.contains('active')) {
                    item.style.transform = 'translateY(0)';
                }
            });
        }
        
        if (isIOS) {
            let touchTimer;
            question.addEventListener('touchstart', (e) => {
                touchTimer = setTimeout(() => {
                    item.classList.add('touch-active');
                }, 50);
            });
            
            question.addEventListener('touchend', (e) => {
                clearTimeout(touchTimer);
                setTimeout(() => {
                    item.classList.remove('touch-active');
                }, 200);
            });
            
            question.style.touchAction = 'manipulation';
            question.style.webkitTouchCallout = 'none';
            question.style.webkitUserSelect = 'none';
        }
    });
    
    if (!document.querySelector('#faq-animations')) {
        const style = document.createElement('style');
        style.id = 'faq-animations';
        style.textContent = `
            @keyframes faqBounce {
                0% { transform: scale(1); }
                50% { transform: scale(1.02); }
                100% { transform: scale(1); }
            }
            
            .faq-item.touch-active {
                background: rgba(0, 255, 239, 0.05) !important;
            }
            
            @supports (-webkit-touch-callout: none) {
                .faq-question {
                    cursor: default;
                    -webkit-tap-highlight-color: transparent;
                }
                
                .faq-item {
                    -webkit-transform: translateZ(0);
                    transform: translateZ(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

function initializeScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                
                if (entry.target.classList.contains('faq-item') && !/iPhone|iPad|iPod/.test(navigator.userAgent)) {
                    setTimeout(() => {
                        entry.target.style.animation = 'faqSlideIn 0.6s ease';
                    }, 100);
                }
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.faq-item').forEach(item => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(30px)';
        item.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(item);
    });
    
    if (!document.querySelector('#scroll-animations')) {
        const style = document.createElement('style');
        style.id = 'scroll-animations';
        style.textContent = `
            @keyframes faqSlideIn {
                0% {
                    opacity: 0;
                    transform: translateY(30px) scale(0.9);
                }
                100% {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

document.querySelector('.switch').addEventListener('click', function() {
    this.classList.toggle('active');
    isAutoRedirectEnabled = !isAutoRedirectEnabled;
    localStorage.setItem('autoRedirect', isAutoRedirectEnabled.toString());
});

bypassBtn.addEventListener('click', processLink);
clipboardBtn.addEventListener('click', checkClipboard);
copyLinkBtn.addEventListener('click', copyToClipboard);
openLinkBtn.addEventListener('click', openLink);

newLinkBtn.addEventListener('click', () => {
    hideModal(resultModal);
    urlInput.value = '';
    urlInput.focus();
});

backHomeBtn.addEventListener('click', () => {
    hideModal(errorModal);
    urlInput.focus();
});

urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        processLink();
    }
});

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        hideModal(resultModal);
        hideModal(errorModal);
    }
});

document.querySelector('.theme-toggle')?.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});

window.forceShr2Detection = function(url) {
    return url && url.toLowerCase().includes('shr2.link') ? 'shr2link' : null;
};

document.getElementById('exampleBtn').addEventListener('click', function() {
    const exampleUrl = 'https://shr2.link/89BVVVXW';
    urlInput.value = exampleUrl;
    
    const originalHTML = this.innerHTML;
    this.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12l5 5l10 -10"></path>
        </svg>
        Example Loaded!
    `;
    this.style.background = 'rgba(0, 255, 38, 0.1)';
    this.style.borderColor = '#00ff26';
    this.style.color = '#00ff26';
    
    setTimeout(() => {
        this.innerHTML = originalHTML;
        this.style.background = 'transparent';
        this.style.borderColor = 'rgba(0, 255, 239, 0.4)';
        this.style.color = 'rgba(0, 255, 239, 0.8)';
    }, 2000);
    
    urlInput.focus();
});

window.addEventListener('load', function() {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.3s ease';
    
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
});

function notifyVisit() {
    fetch("/api/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ua: navigator.userAgent })
    }).catch(() => {});
}

window.addEventListener("load", notifyVisit);