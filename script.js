document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'color' ? 'dark' : 'color';
        
        if (newTheme === 'color') {
            document.documentElement.setAttribute('data-theme', 'color');
            localStorage.setItem('theme', 'color');
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'dark');
        }
    });
    
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', () => {
        const isColorTheme = document.documentElement.getAttribute('data-theme') === 'color';
        if (window.scrollY > 50) {
            navbar.style.background = isColorTheme ? 'rgba(248, 245, 241, 0.98)' : 'rgba(10, 10, 10, 0.95)';
        } else {
            navbar.style.background = isColorTheme ? 'rgba(248, 245, 241, 0.9)' : 'rgba(10, 10, 10, 0.8)';
        }
    });
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };
    
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.section').forEach(section => {
        sectionObserver.observe(section);
    });
    
    const itemObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, index * 100);
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.timeline-item').forEach(item => {
        itemObserver.observe(item);
    });
    
    document.querySelectorAll('.skill-category').forEach((category, index) => {
        category.style.transitionDelay = `${index * 0.1}s`;
        itemObserver.observe(category);
    });
    
    document.querySelectorAll('.interests-list li').forEach((item, index) => {
        item.style.transitionDelay = `${index * 0.1}s`;
        itemObserver.observe(item);
    });
    
    document.querySelectorAll('.education-item').forEach((item, index) => {
        item.style.transitionDelay = `${index * 0.15}s`;
        itemObserver.observe(item);
    });
    
    document.querySelectorAll('.language').forEach((lang, index) => {
        lang.style.transitionDelay = `${index * 0.1}s`;
        itemObserver.observe(lang);
    });
    
    document.querySelectorAll('.contact-item').forEach((item, index) => {
        item.style.transitionDelay = `${index * 0.15}s`;
        itemObserver.observe(item);
    });
    
    const heroContent = document.querySelector('.hero-content');
    heroContent.style.opacity = '1';
    heroContent.style.transform = 'none';
});

document.addEventListener('mousemove', (e) => {
    let glow = document.querySelector('.cursor-glow');
    if (!glow) {
        glow = document.createElement('div');
        glow.className = 'cursor-glow';
        document.body.appendChild(glow);
    }
    glow.style.left = (e.clientX - 200) + 'px';
    glow.style.top = (e.clientY - 200) + 'px';
});