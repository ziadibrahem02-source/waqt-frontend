(() => {
    'use strict';

    const isLocalDevelopment = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
    const defaultApiBase = window.location.protocol === 'file:' || isLocalDevelopment
        ? 'http://localhost:5000/api'
        : `${window.location.origin}/api`;
    const API_BASE = String(window.WAQT_API_BASE || defaultApiBase).replace(/\/+$/, '');
    const CART_STORAGE_KEY = 'waqt_cart';
    const THEME_STORAGE_KEY = 'waqt_theme';
    const LANGUAGE_STORAGE_KEY = 'waqt_language';
    const ADMIN_SESSION_KEY = 'waqt_admin_session';
    const USER_SESSION_KEY = 'waqt_user_session';
    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const EGYPT_PHONE_PATTERN = /^01[0125]\d{8}$/;
    const PAYMENT_METHODS = new Set(['instapay', 'wallet', 'cod']);
    const SAFE_IMAGE_DATA_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/]+=*$/i;

    const state = {
        language: 'ar',
        dark: false,
        watches: [],
        selectedWatch: null,
        cart: [],
        productImages: [],
        requestInProgress: false
    };

    const byId = (id) => document.getElementById(id);

    function readStorage(storage, key) {
        try {
            return storage.getItem(key);
        } catch (error) {
            console.error(`Unable to read ${key} from browser storage.`, error);
            return null;
        }
    }

    function writeStorage(storage, key, value) {
        try {
            storage.setItem(key, value);
            return true;
        } catch (error) {
            console.error(`Unable to save ${key} to browser storage.`, error);
            return false;
        }
    }

    function removeStorage(storage, key) {
        try {
            storage.removeItem(key);
        } catch (error) {
            console.error(`Unable to remove ${key} from browser storage.`, error);
        }
    }

    function text(key, fallbackAr, fallbackEn) {
        const messages = {
            'cart.empty': ['سلة المشتريات فارغة حالياً.', 'Your cart is currently empty.'],
            'cart.added': ['تمت إضافة المنتج إلى السلة.', 'The product was added to your cart.'],
            'cart.invalid': ['تعذر العثور على هذا المنتج.', 'This product could not be found.'],
            'cart.remove': ['إزالة', 'Remove'],
            'checkout.empty': ['السلة فارغة. أضف منتجاً أولاً.', 'Your cart is empty. Add a product first.'],
            'checkout.invalid': ['يرجى مراجعة البيانات المدخلة والتأكد من صحتها.', 'Please review the information you entered.'],
            'checkout.phone': ['أدخل رقم هاتف مصرياً صحيحاً من 11 رقماً يبدأ بـ 01.', 'Enter a valid 11-digit Egyptian phone number starting with 01.'],
            'checkout.email': ['أدخل بريداً إلكترونياً صحيحاً.', 'Enter a valid email address.'],
            'checkout.success': ['تم إرسال طلبك بنجاح. سنتواصل معك قريباً.', 'Your order was submitted successfully. We will contact you soon.'],
            'checkout.failed': ['تعذر إرسال الطلب. حاول مرة أخرى لاحقاً.', 'We could not submit your order. Please try again later.'],
            'auth.failed': ['تعذر تسجيل الدخول. تحقق من البيانات وحاول مجدداً.', 'Sign-in failed. Check your details and try again.'],
            'auth.registered': ['تم إنشاء الحساب بنجاح. يمكنك تسجيل الدخول الآن.', 'Your account was created. You can now sign in.'],
            'auth.failedRegister': ['تعذر إنشاء الحساب. تحقق من البيانات وحاول مجدداً.', 'We could not create your account. Check your details and try again.'],
            'admin.denied': ['تعذر التحقق من صلاحية الأدمن. سجل الدخول مجدداً.', 'Admin access could not be verified. Please sign in again.'],
            'admin.loggedOut': ['تم تسجيل الخروج.', 'You have been signed out.'],
            'network.failed': ['تعذر الاتصال بالخادم. حاول مرة أخرى لاحقاً.', 'Could not connect to the server. Please try again later.'],
            'watches.failed': ['تعذر تحميل الساعات. تحقق من اتصال الخادم.', 'Could not load watches. Check the server connection.'],
            'watches.empty': ['لا توجد ساعات متاحة حالياً.', 'No watches are available right now.'],
            'product.added': ['تمت إضافة الساعة بنجاح.', 'The watch was added successfully.'],
            'product.failed': ['تعذر إضافة الساعة. تحقق من البيانات وحاول مجدداً.', 'Could not add the watch. Check the details and try again.'],
            'product.deleted': ['تم حذف الساعة.', 'The watch was deleted.'],
            'product.deleteFailed': ['تعذر حذف الساعة.', 'The watch could not be deleted.'],
            'images.limit': ['الحد الأقصى هو 8 صور.', 'You can upload up to 8 images.'],
            'images.invalid': ['اختر صور JPG أو PNG أو WebP فقط، بحجم أقصى 5 ميجابايت للصورة.', 'Choose JPG, PNG, or WebP images up to 5 MB each.'],
            'admin.ordersFailed': ['تعذر تحميل الطلبات أو انتهت الجلسة.', 'Could not load orders or the session expired.'],
            'admin.productsFailed': ['تعذر تحميل المنتجات.', 'Could not load products.']
        };
        const value = messages[key];
        if (!value) return state.language === 'ar' ? fallbackAr : fallbackEn;
        return state.language === 'ar' ? value[0] : value[1];
    }

    function notify(message, kind = 'success') {
        const container = byId('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `custom-toast${kind === 'error' ? ' error' : ''}`;
        toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        toast.textContent = message;
        container.appendChild(toast);
        window.setTimeout(() => toast.remove(), 4500);
    }

    function setInlineError(elementId, message) {
        const element = byId(elementId);
        if (!element) return;
        element.textContent = message;
        element.classList.toggle('hidden', !message);
    }

    function safeImageUrl(value) {
        if (typeof value !== 'string' || value.length > 2_000_000) return '';
        if (SAFE_IMAGE_DATA_PATTERN.test(value)) return value;
        try {
            const url = new URL(value, window.location.href);
            if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
        } catch (error) {
            return '';
        }
        return '';
    }

    function normalizeWatch(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const id = String(raw._id ?? raw.id ?? '').trim();
        const price = Number(raw.price);
        if (!id || id.length > 128 || !Number.isFinite(price) || price < 0) return null;
        const images = Array.isArray(raw.images)
            ? raw.images.slice(0, 8).map(safeImageUrl).filter(Boolean)
            : [];
        return {
            _id: id,
            nameAr: String(raw.nameAr || 'ساعة فاخرة').slice(0, 120),
            nameEn: String(raw.nameEn || raw.nameAr || 'Luxury Watch').slice(0, 120),
            descAr: String(raw.descAr || 'ساعة فاخرة مصممة بأعلى معايير الجودة والتصميم الراقي.').slice(0, 1500),
            descEn: String(raw.descEn || 'Luxury watch designed with the highest quality standards.').slice(0, 1500),
            price,
            images
        };
    }

    function normalizeCartItem(raw) {
        const watch = normalizeWatch(raw);
        const quantity = Number(raw && raw.quantity);
        if (!watch || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return null;
        return { ...watch, quantity };
    }

    function loadCartFromStorage() {
        const stored = readStorage(window.localStorage, CART_STORAGE_KEY);
        if (!stored) return [];
        try {
            const parsed = JSON.parse(stored);
            if (!Array.isArray(parsed)) throw new TypeError('Stored cart must be an array.');
            return parsed.map(normalizeCartItem).filter(Boolean);
        } catch (error) {
            console.error('The stored cart is invalid and has been discarded.', error);
            removeStorage(window.localStorage, CART_STORAGE_KEY);
            return [];
        }
    }

    function saveCart() {
        if (!writeStorage(window.localStorage, CART_STORAGE_KEY, JSON.stringify(state.cart))) {
            notify(text('network.failed'), 'error');
        }
        renderCart();
    }

    async function apiRequest(path, options = {}) {
        const requestUrl = new URL(`${API_BASE}${path}`, window.location.href);
        const isLocalDevelopment = ['localhost', '127.0.0.1', '[::1]'].includes(requestUrl.hostname);
        if (requestUrl.protocol !== 'https:' && !isLocalDevelopment) {
            throw new Error('API requests require HTTPS outside local development.');
        }
        const headers = new Headers(options.headers || {});
        if (options.body !== undefined && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
        const response = await fetch(requestUrl.href, {
            ...options,
            headers,
            credentials: 'omit',
            cache: 'no-store'
        });
        let data = null;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const responseText = await response.text();
            if (responseText) data = { message: responseText.slice(0, 500) };
        }
        if (!response.ok) {
            const error = new Error(`API request failed with status ${response.status}.`);
            error.status = response.status;
            error.data = data;
            throw error;
        }
        return data;
    }

    function authorizationHeaders(token) {
        if (typeof token !== 'string' || token.length < 1 || token.length > 4096) {
            throw new Error('Missing or invalid session token.');
        }
        return { Authorization: `Bearer ${token}` };
    }

    function getAdminToken() {
        return readStorage(window.sessionStorage, ADMIN_SESSION_KEY);
    }

    function getUserToken() {
        return readStorage(window.sessionStorage, USER_SESSION_KEY);
    }

    function updateLanguage(language) {
        state.language = language === 'en' ? 'en' : 'ar';
        const root = byId('html-root');
        if (root) {
            root.lang = state.language;
            root.dir = state.language === 'ar' ? 'rtl' : 'ltr';
        }
        document.body.classList.toggle('ar-mode', state.language === 'ar');
        document.body.classList.toggle('en-mode', state.language === 'en');
        const accountButton = document.querySelector('[data-action="login"]');
        if (accountButton) accountButton.title = state.language === 'ar' ? 'حسابي' : 'My account';
        const arabicProductName = byId('wNameAr');
        const englishProductName = byId('wNameEn');
        const productPrice = byId('wPrice');
        if (arabicProductName) arabicProductName.placeholder = state.language === 'ar' ? 'اسم الساعة (عربي)' : 'Watch name (Arabic)';
        if (englishProductName) englishProductName.placeholder = state.language === 'ar' ? 'اسم الساعة (إنجليزي)' : 'Watch name (English)';
        if (productPrice) productPrice.placeholder = state.language === 'ar' ? 'السعر / Price (EGP)' : 'Price (EGP)';
        renderCart();
        writeStorage(window.localStorage, LANGUAGE_STORAGE_KEY, state.language);
    }

    function setTheme(dark) {
        state.dark = Boolean(dark);
        document.body.classList.toggle('dark-theme', state.dark);
        const icon = byId('themeIcon');
        if (icon) {
            icon.classList.toggle('fa-sun', state.dark);
            icon.classList.toggle('fa-moon', !state.dark);
        }
        writeStorage(window.localStorage, THEME_STORAGE_KEY, state.dark ? 'dark' : 'light');
    }

    function setModalOpen(modalId, open) {
        const modal = byId(modalId);
        if (!modal) return;
        modal.classList.toggle('active', open);
        modal.setAttribute('aria-hidden', String(!open));
        document.body.classList.toggle('modal-open', Boolean(document.querySelector('.modal-overlay.active')));
        document.body.style.overflow = document.querySelector('.modal-overlay.active') ? 'hidden' : '';
    }

    function formatPrice(value) {
        return `${Number(value).toLocaleString(state.language === 'ar' ? 'ar-EG' : 'en-US', {
            maximumFractionDigits: 2
        })} EGP`;
    }

    function makeButton(labelAr, labelEn, action, className) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.dataset.action = action;
        const ar = document.createElement('span');
        ar.className = 'arabic-text';
        ar.textContent = labelAr;
        const en = document.createElement('span');
        en.className = 'english-text';
        en.textContent = labelEn;
        button.append(ar, en);
        return button;
    }

    function renderWatches() {
        const container = byId('watchesContainer');
        const loader = byId('watchesLoader');
        const message = byId('watchesMessage');
        if (!container || !message) return;
        if (loader) loader.classList.add('hidden');
        container.replaceChildren();
        message.classList.add('hidden');
        if (state.watches.length === 0) {
            message.textContent = text('watches.empty');
            message.classList.remove('hidden');
            return;
        }

        const fragment = document.createDocumentFragment();
        state.watches.forEach((watch) => {
            const card = document.createElement('article');
            card.className = 'watch-card p-4';
            const imageButton = document.createElement('button');
            imageButton.type = 'button';
            imageButton.className = 'watch-image-wrapper mb-4 w-full cursor-pointer';
            imageButton.dataset.action = 'product';
            imageButton.dataset.productId = watch._id;
            imageButton.setAttribute('aria-label', watch.nameAr);
            const image = document.createElement('img');
            image.src = watch.images[0] || '';
            image.alt = watch.nameAr;
            image.loading = 'lazy';
            imageButton.appendChild(image);

            const titleButton = document.createElement('button');
            titleButton.type = 'button';
            titleButton.className = 'watch-name-button mb-2 text-xl font-bold text-gray-900 dark:text-white';
            titleButton.dataset.action = 'product';
            titleButton.dataset.productId = watch._id;
            const titleAr = document.createElement('span');
            titleAr.className = 'arabic-text';
            titleAr.textContent = watch.nameAr;
            const titleEn = document.createElement('span');
            titleEn.className = 'english-text';
            titleEn.textContent = watch.nameEn;
            titleButton.append(titleAr, titleEn);

            const price = document.createElement('p');
            price.className = 'mb-4 text-xl font-bold text-waqt-gold';
            price.textContent = formatPrice(watch.price);
            const addButton = makeButton('إضافة للسلة', 'Add to cart', 'add-product', 'watch-card-add');
            addButton.dataset.productId = watch._id;
            addButton.appendChild(document.createTextNode(' '));
            const icon = document.createElement('i');
            icon.className = 'fas fa-shopping-cart';
            addButton.appendChild(icon);
            card.append(imageButton, titleButton, price, addButton);
            fragment.appendChild(card);
        });
        container.appendChild(fragment);
    }

    async function loadPublicWatches() {
        const loader = byId('watchesLoader');
        const message = byId('watchesMessage');
        if (loader) loader.classList.remove('hidden');
        if (message) message.classList.add('hidden');
        try {
            const data = await apiRequest('/watches');
            if (!Array.isArray(data)) throw new TypeError('The watches endpoint must return an array.');
            state.watches = data.map(normalizeWatch).filter(Boolean);
            renderWatches();
        } catch (error) {
            console.error('Could not load public watches.', error);
            if (loader) loader.classList.add('hidden');
            if (message) {
                message.textContent = text('watches.failed');
                message.classList.remove('hidden');
            }
            notify(text('watches.failed'), 'error');
        }
    }

    function showSection(sectionIds, showNavigation = true) {
        document.querySelectorAll('.page-section').forEach((section) => section.classList.add('hidden'));
        sectionIds.forEach((id) => {
            const section = byId(id);
            if (section) section.classList.remove('hidden');
        });
        const nav = byId('mainNav');
        const footer = byId('mainFooter');
        if (nav) nav.classList.toggle('hidden', !showNavigation);
        if (footer) footer.classList.toggle('hidden', !showNavigation);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function navigateTo(page) {
        if (page === 'admin_dashboard') {
            const token = getAdminToken();
            if (!token || !await fetchAdminOrders({ quiet: true })) {
                removeStorage(window.sessionStorage, ADMIN_SESSION_KEY);
                showSection(['loginSection'], false);
                notify(text('admin.denied'), 'error');
                return;
            }
            showSection(['adminDashboardSection'], false);
            return;
        }
        if (page === 'login') {
            showSection(['loginSection'], false);
        } else if (page === 'collection') {
            showSection(['collection']);
            if (state.watches.length === 0) await loadPublicWatches();
        } else if (page === 'about') {
            showSection(['aboutSection']);
        } else if (page === 'product' && state.selectedWatch) {
            showSection(['productDetailsSection']);
        } else {
            showSection(['home', 'collection', 'about', 'whyChooseUs']);
            if (state.watches.length === 0) await loadPublicWatches();
        }
    }

    function openProductDetails(id) {
        const watch = state.watches.find((item) => item._id === String(id));
        if (!watch) {
            notify(text('cart.invalid'), 'error');
            return;
        }
        state.selectedWatch = watch;
        const mainImage = byId('pageMainImg');
        if (mainImage) {
            mainImage.src = watch.images[0] || '';
            mainImage.alt = watch.nameAr;
        }
        byId('pageTitleAr').textContent = watch.nameAr;
        byId('pageTitleEn').textContent = watch.nameEn;
        byId('pagePrice').textContent = formatPrice(watch.price);
        byId('pagePriceBottom').textContent = formatPrice(watch.price);
        byId('pageDescAr').textContent = watch.descAr;
        byId('pageDescEn').textContent = watch.descEn;

        const thumbnails = byId('pageThumbnails');
        thumbnails.replaceChildren();
        watch.images.forEach((imageUrl, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `thumb-img h-20 w-20 shrink-0${index === 0 ? ' active' : ''}`;
            button.dataset.action = 'thumbnail';
            button.dataset.imageUrl = imageUrl;
            const image = document.createElement('img');
            image.src = imageUrl;
            image.alt = `${watch.nameAr} ${index + 1}`;
            image.className = 'h-full w-full object-cover';
            button.appendChild(image);
            thumbnails.appendChild(button);
        });
        navigateTo('product');
    }

    function addToCart(watch) {
        if (!watch) {
            notify(text('cart.invalid'), 'error');
            return;
        }
        const existing = state.cart.find((item) => item._id === watch._id);
        if (existing) {
            if (existing.quantity >= 99) return;
            existing.quantity += 1;
        } else {
            state.cart.push({ ...watch, quantity: 1 });
        }
        saveCart();
        notify(text('cart.added'));
        setModalOpen('cartModal', true);
    }

    function makeCartItem(item, index) {
        const row = document.createElement('article');
        row.className = 'flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-[#1f1f1f]';
        const image = document.createElement('img');
        image.src = item.images[0] || '';
        image.alt = item.nameAr;
        image.className = 'h-16 w-16 rounded-lg border border-waqt-gold object-cover';
        const details = document.createElement('div');
        details.className = 'min-w-0 flex-grow px-2';
        const name = document.createElement('h3');
        name.className = 'truncate text-sm font-bold text-gray-900 dark:text-white';
        name.textContent = state.language === 'ar' ? item.nameAr : item.nameEn;
        const price = document.createElement('p');
        price.className = 'text-xs font-bold text-waqt-gold';
        price.textContent = formatPrice(item.price);
        details.append(name, price);

        const quantityControls = document.createElement('div');
        quantityControls.className = 'flex shrink-0 items-center gap-2';
        const minus = document.createElement('button');
        minus.type = 'button';
        minus.className = 'rounded bg-gray-200 px-2 py-1 text-sm dark:bg-gray-800';
        minus.textContent = '−';
        minus.setAttribute('aria-label', state.language === 'ar' ? 'تقليل الكمية' : 'Decrease quantity');
        minus.dataset.action = 'quantity';
        minus.dataset.index = String(index);
        minus.dataset.delta = '-1';
        const quantity = document.createElement('span');
        quantity.className = 'min-w-5 text-center text-sm font-bold';
        quantity.textContent = String(item.quantity);
        const plus = document.createElement('button');
        plus.type = 'button';
        plus.className = 'rounded bg-gray-200 px-2 py-1 text-sm dark:bg-gray-800';
        plus.textContent = '+';
        plus.setAttribute('aria-label', state.language === 'ar' ? 'زيادة الكمية' : 'Increase quantity');
        plus.dataset.action = 'quantity';
        plus.dataset.index = String(index);
        plus.dataset.delta = '1';
        quantityControls.append(minus, quantity, plus);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'ms-1 shrink-0 text-red-500';
        remove.dataset.action = 'remove-cart-item';
        remove.dataset.index = String(index);
        remove.setAttribute('aria-label', text('cart.remove', 'إزالة', 'Remove'));
        const icon = document.createElement('i');
        icon.className = 'fas fa-trash text-xs';
        remove.appendChild(icon);
        row.append(image, details, quantityControls, remove);
        return row;
    }

    function renderCart() {
        const container = byId('cartItemsContainer');
        const totalElement = byId('cartTotal');
        const countElement = byId('cartCount');
        if (!container || !totalElement || !countElement) return;
        const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
        const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        countElement.textContent = String(count);
        totalElement.textContent = formatPrice(total);
        container.replaceChildren();
        if (state.cart.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'py-10 text-center text-gray-400';
            empty.textContent = text('cart.empty');
            container.appendChild(empty);
            return;
        }
        const fragment = document.createDocumentFragment();
        state.cart.forEach((item, index) => fragment.appendChild(makeCartItem(item, index)));
        container.appendChild(fragment);
    }

    function changeQuantity(index, delta) {
        if (!Number.isInteger(index) || !state.cart[index] || ![-1, 1].includes(delta)) return;
        const updated = state.cart[index].quantity + delta;
        if (updated < 1) {
            state.cart.splice(index, 1);
        } else if (updated <= 99) {
            state.cart[index].quantity = updated;
        }
        saveCart();
    }

    function openCheckout() {
        if (state.cart.length === 0) {
            notify(text('checkout.empty'), 'error');
            return;
        }
        setModalOpen('cartModal', false);
        setInlineError('checkoutError', '');
        setModalOpen('checkoutModal', true);
    }

    function validCheckoutData() {
        const fullName = byId('cName').value.trim();
        const email = byId('cEmail').value.trim();
        const phone1 = byId('cPhone1').value.trim();
        const phone2 = byId('cPhone2').value.trim();
        const governorate = byId('cGov').value;
        const address = byId('cAddress').value.trim();
        const notes = byId('cNotes').value.trim();
        const paymentMethod = byId('cPayment').value;
        const validGovernorates = new Set(Array.from(byId('cGov').options, (option) => option.value).filter(Boolean));

        if (fullName.length < 2 || fullName.length > 100 || !EMAIL_PATTERN.test(email) || email.length > 254 ||
            !EGYPT_PHONE_PATTERN.test(phone1) || (phone2 && !EGYPT_PHONE_PATTERN.test(phone2)) ||
            !validGovernorates.has(governorate) || address.length < 8 || address.length > 500 ||
            notes.length > 500 || !PAYMENT_METHODS.has(paymentMethod)) {
            if (!EMAIL_PATTERN.test(email)) {
                setInlineError('checkoutError', text('checkout.email'));
            } else if (!EGYPT_PHONE_PATTERN.test(phone1) || (phone2 && !EGYPT_PHONE_PATTERN.test(phone2))) {
                setInlineError('checkoutError', text('checkout.phone'));
            } else {
                setInlineError('checkoutError', text('checkout.invalid'));
            }
            return null;
        }
        setInlineError('checkoutError', '');
        return { fullName, email, phone1, phone2, governorate, address, notes, paymentMethod };
    }

    async function submitOrder(event) {
        event.preventDefault();
        if (state.requestInProgress) return;
        const details = validCheckoutData();
        if (!details) return;
        if (state.cart.length === 0) {
            notify(text('checkout.empty'), 'error');
            setModalOpen('checkoutModal', false);
            return;
        }

        const button = byId('checkoutSubmit');
        state.requestInProgress = true;
        if (button) button.disabled = true;
        const orderData = {
            customerDetails: {
                fullName: details.fullName,
                phone: details.phone1,
                phone2: details.phone2,
                email: details.email,
                governorate: details.governorate,
                address: details.address,
                notes: details.notes,
                paymentMethod: details.paymentMethod
            },
            items: state.cart.map((item) => ({ watchId: item._id, quantity: item.quantity })),
            totalAmount: state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
        };

        try {
            const headers = {};
            const userToken = getUserToken();
            if (userToken) Object.assign(headers, authorizationHeaders(userToken));
            await apiRequest('/orders', {
                method: 'POST',
                headers,
                body: JSON.stringify(orderData)
            });
            state.cart = [];
            saveCart();
            byId('checkoutForm').reset();
            setModalOpen('checkoutModal', false);
            notify(text('checkout.success'));
            await navigateTo('home');
        } catch (error) {
            console.error('Order submission failed.', error);
            const message = error.data && typeof error.data.error === 'string'
                ? error.data.error.slice(0, 250)
                : text('checkout.failed');
            setInlineError('checkoutError', message);
            notify(message, 'error');
        } finally {
            state.requestInProgress = false;
            if (button) button.disabled = false;
        }
    }

    function readToken(data) {
        const token = data && typeof data.token === 'string' ? data.token.trim() : '';
        if (!token || token.length > 4096) throw new Error('The authentication response did not include a valid token.');
        return token;
    }

    async function handleLogin(event) {
        event.preventDefault();
        setInlineError('loginError', '');
        const identifier = byId('loginEmail').value.trim();
        const password = byId('loginPassword').value;
        if (!identifier || password.length < 8 || password.length > 128) {
            setInlineError('loginError', text('auth.failed'));
            return;
        }
        const isAdmin = !EMAIL_PATTERN.test(identifier);
        try {
            const result = await apiRequest(isAdmin ? '/admin/login' : '/users/login', {
                method: 'POST',
                body: JSON.stringify(isAdmin
                    ? { username: identifier, password }
                    : { email: identifier, password })
            });
            const token = readToken(result);
            if (isAdmin) {
                removeStorage(window.sessionStorage, ADMIN_SESSION_KEY);
                if (!writeStorage(window.sessionStorage, ADMIN_SESSION_KEY, token)) {
                    throw new Error('Unable to store the temporary admin session.');
                }
                if (!await fetchAdminOrders({ quiet: true })) {
                    removeStorage(window.sessionStorage, ADMIN_SESSION_KEY);
                    throw new Error('The backend rejected the admin session.');
                }
                byId('loginForm').reset();
                await navigateTo('admin_dashboard');
            } else {
                writeStorage(window.sessionStorage, USER_SESSION_KEY, token);
                byId('loginForm').reset();
                notify(state.language === 'ar' ? 'مرحباً بعودتك.' : 'Welcome back.');
                await navigateTo('home');
            }
        } catch (error) {
            console.error('Sign-in failed.', error);
            const message = error.data && typeof error.data.error === 'string'
                ? error.data.error.slice(0, 250)
                : text('auth.failed');
            setInlineError('loginError', message);
        }
    }

    async function handleRegister(event) {
        event.preventDefault();
        setInlineError('registerError', '');
        const name = byId('regName').value.trim();
        const email = byId('regEmail').value.trim();
        const password = byId('regPassword').value;
        if (name.length < 2 || name.length > 100 || !EMAIL_PATTERN.test(email) || password.length < 8 || password.length > 128) {
            setInlineError('registerError', text('auth.failedRegister'));
            return;
        }
        try {
            await apiRequest('/users/register', {
                method: 'POST',
                body: JSON.stringify({ name, email, password })
            });
            byId('registerForm').reset();
            toggleAuthTab('login');
            byId('loginEmail').value = email;
            notify(text('auth.registered'));
        } catch (error) {
            console.error('Account registration failed.', error);
            const message = error.data && typeof error.data.error === 'string'
                ? error.data.error.slice(0, 250)
                : text('auth.failedRegister');
            setInlineError('registerError', message);
        }
    }

    function toggleAuthTab(tab) {
        const loginSelected = tab === 'login';
        byId('loginForm').classList.toggle('hidden', !loginSelected);
        byId('registerForm').classList.toggle('hidden', loginSelected);
        byId('tab-login').classList.toggle('active', loginSelected);
        byId('tab-register').classList.toggle('active', !loginSelected);
        setInlineError('loginError', '');
        setInlineError('registerError', '');
    }

    function logoutAdmin() {
        removeStorage(window.sessionStorage, ADMIN_SESSION_KEY);
        showSection(['home', 'collection', 'about', 'whyChooseUs']);
        notify(text('admin.loggedOut'));
    }

    async function fetchAdminOrders(options = {}) {
        const tbody = byId('adminOrdersTableBody');
        const token = getAdminToken();
        if (!token || !tbody) return false;
        try {
            const orders = await apiRequest('/admin/orders', { headers: authorizationHeaders(token) });
            if (!Array.isArray(orders)) throw new TypeError('The orders endpoint must return an array.');
            tbody.replaceChildren();
            if (orders.length === 0) {
                const row = document.createElement('tr');
                const cell = document.createElement('td');
                cell.colSpan = 4;
                cell.className = 'py-4 text-center text-gray-500';
                cell.textContent = state.language === 'ar' ? 'لا توجد طلبات حتى الآن.' : 'There are no orders yet.';
                row.appendChild(cell);
                tbody.appendChild(row);
            } else {
                orders.forEach((order) => {
                    const row = document.createElement('tr');
                    const customerDetails = order && order.customerDetails ? order.customerDetails : {};
                    const items = Array.isArray(order && order.items) ? order.items : [];
                    const watchName = order && order.watchId && typeof order.watchId.nameAr === 'string'
                        ? order.watchId.nameAr
                        : items.map((item) => item && item.watchId && item.watchId.nameAr).filter(Boolean).join(', ');
                    const customer = String(customerDetails.fullName || customerDetails.name || '').slice(0, 100);
                    const price = Number(order && order.totalAmount);
                    const createdAt = new Date(order && order.createdAt);
                    const values = [
                        customer || '—',
                        String(watchName || '—').slice(0, 300),
                        Number.isFinite(price) ? formatPrice(price) : '—',
                        Number.isNaN(createdAt.getTime()) ? '—' : createdAt.toLocaleDateString(state.language === 'ar' ? 'ar-EG' : 'en-US')
                    ];
                    values.forEach((value) => {
                        const cell = document.createElement('td');
                        cell.className = 'py-4';
                        cell.textContent = value;
                        row.appendChild(cell);
                    });
                    tbody.appendChild(row);
                });
            }
            return true;
        } catch (error) {
            console.error('Could not fetch admin orders.', error);
            if (error.status === 401 || error.status === 403) removeStorage(window.sessionStorage, ADMIN_SESSION_KEY);
            if (tbody) {
                const row = document.createElement('tr');
                const cell = document.createElement('td');
                cell.colSpan = 4;
                cell.className = 'py-4 text-center text-red-500';
                cell.textContent = text('admin.ordersFailed');
                row.appendChild(cell);
                tbody.replaceChildren(row);
            }
            if (!options.quiet) notify(text('admin.ordersFailed'), 'error');
            return false;
        }
    }

    async function fetchAdminWatches() {
        const tbody = byId('adminWatchesTableBody');
        const token = getAdminToken();
        if (!token || !tbody) return false;
        try {
            const data = await apiRequest('/admin/watches', { headers: authorizationHeaders(token) });
            if (!Array.isArray(data)) throw new TypeError('The admin watches endpoint must return an array.');
            tbody.replaceChildren();
            data.map(normalizeWatch).filter(Boolean).forEach((watch) => {
                const row = document.createElement('tr');
                const imageCell = document.createElement('td');
                const image = document.createElement('img');
                image.src = watch.images[0] || '';
                image.alt = watch.nameAr;
                image.className = 'h-12 w-12 rounded border border-waqt-gold object-cover';
                imageCell.appendChild(image);
                const nameCell = document.createElement('td');
                nameCell.className = 'py-3';
                nameCell.textContent = state.language === 'ar' ? watch.nameAr : watch.nameEn;
                const priceCell = document.createElement('td');
                priceCell.className = 'py-3 text-waqt-gold';
                priceCell.textContent = formatPrice(watch.price);
                const actionCell = document.createElement('td');
                actionCell.className = 'py-3';
                const removeButton = document.createElement('button');
                removeButton.type = 'button';
                removeButton.className = 'rounded bg-red-500/10 px-3 py-1 text-red-500';
                removeButton.dataset.action = 'delete-watch';
                removeButton.dataset.productId = watch._id;
                removeButton.textContent = state.language === 'ar' ? 'حذف' : 'Delete';
                actionCell.appendChild(removeButton);
                row.append(imageCell, nameCell, priceCell, actionCell);
                tbody.appendChild(row);
            });
            return true;
        } catch (error) {
            console.error('Could not fetch admin products.', error);
            if (error.status === 401 || error.status === 403) removeStorage(window.sessionStorage, ADMIN_SESSION_KEY);
            notify(text('admin.productsFailed'), 'error');
            return false;
        }
    }

    async function switchAdminTab(tabName) {
        const token = getAdminToken();
        if (!token || byId('adminDashboardSection').classList.contains('hidden')) {
            notify(text('admin.denied'), 'error');
            await navigateTo('login');
            return;
        }
        const ordersTab = byId('adminOrdersTab');
        const productsTab = byId('adminProductsTab');
        const showOrders = tabName === 'orders';
        ordersTab.classList.toggle('hidden', !showOrders);
        productsTab.classList.toggle('hidden', showOrders);
        if (showOrders) await fetchAdminOrders();
        else await fetchAdminWatches();
    }

    function updateImagePreviews() {
        const container = byId('imagePreviewContainer');
        const count = byId('imgCount');
        if (!container || !count) return;
        count.textContent = `(${state.productImages.length}/8)`;
        container.replaceChildren();
        state.productImages.forEach((source, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'relative h-24 w-24 overflow-hidden rounded-lg border border-gray-600';
            const image = document.createElement('img');
            image.src = source;
            image.alt = `Product image ${index + 1}`;
            image.className = 'h-full w-full object-cover';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white';
            remove.dataset.action = 'remove-image';
            remove.dataset.index = String(index);
            remove.setAttribute('aria-label', state.language === 'ar' ? 'إزالة الصورة' : 'Remove image');
            remove.textContent = '×';
            wrapper.append(image, remove);
            container.appendChild(wrapper);
        });
    }

    function loadImageAsJpeg(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Could not read image file.'));
            reader.onload = () => {
                const image = new Image();
                image.onerror = () => reject(new Error('Selected file is not a decodable image.'));
                image.onload = () => {
                    const maxSize = 1000;
                    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(image.width * scale));
                    canvas.height = Math.max(1, Math.round(image.height * scale));
                    const context = canvas.getContext('2d');
                    if (!context) {
                        reject(new Error('Image compression is unavailable.'));
                        return;
                    }
                    context.drawImage(image, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.78));
                };
                image.src = String(reader.result);
            };
            reader.readAsDataURL(file);
        });
    }

    async function handleImageFiles(fileList) {
        const files = Array.from(fileList || []);
        if (state.productImages.length + files.length > 8) {
            notify(text('images.limit'), 'error');
            return;
        }
        if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
            notify(text('images.invalid'), 'error');
            return;
        }
        try {
            const images = await Promise.all(files.map(loadImageAsJpeg));
            state.productImages.push(...images);
            updateImagePreviews();
        } catch (error) {
            console.error('Could not process product images.', error);
            notify(text('images.invalid'), 'error');
        } finally {
            const input = byId('fileInput');
            if (input) input.value = '';
        }
    }

    async function handleAddWatch(event) {
        event.preventDefault();
        const token = getAdminToken();
        if (!token) {
            notify(text('admin.denied'), 'error');
            await navigateTo('login');
            return;
        }
        const nameAr = byId('wNameAr').value.trim();
        const nameEn = byId('wNameEn').value.trim();
        const price = Number(byId('wPrice').value);
        if (nameAr.length < 2 || nameAr.length > 120 || nameEn.length < 2 || nameEn.length > 120 ||
            !Number.isFinite(price) || price <= 0 || price > 100000000 || state.productImages.length === 0) {
            notify(text('product.failed'), 'error');
            return;
        }
        try {
            await apiRequest('/admin/watches', {
                method: 'POST',
                headers: authorizationHeaders(token),
                body: JSON.stringify({
                    nameAr,
                    nameEn,
                    price,
                    images: state.productImages.slice(),
                    descAr: 'ساعة فاخرة مصممة بأعلى معايير الجودة والتصميم الراقي.',
                    descEn: 'Luxury watch designed with the highest quality standards.'
                })
            });
            byId('addWatchForm').reset();
            state.productImages = [];
            updateImagePreviews();
            await fetchAdminWatches();
            await loadPublicWatches();
            notify(text('product.added'));
        } catch (error) {
            console.error('Could not add product.', error);
            if (error.status === 401 || error.status === 403) removeStorage(window.sessionStorage, ADMIN_SESSION_KEY);
            const message = error.data && typeof error.data.error === 'string'
                ? error.data.error.slice(0, 250)
                : text('product.failed');
            notify(message, 'error');
        }
    }

    async function deleteWatch(id) {
        if (!id || id.length > 128) return;
        const confirmed = window.confirm(state.language === 'ar' ? 'هل تريد حذف هذه الساعة؟' : 'Delete this watch?');
        if (!confirmed) return;
        const token = getAdminToken();
        if (!token) {
            await navigateTo('login');
            return;
        }
        try {
            await apiRequest(`/admin/watches/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: authorizationHeaders(token)
            });
            await fetchAdminWatches();
            await loadPublicWatches();
            notify(text('product.deleted'));
        } catch (error) {
            console.error('Could not delete product.', error);
            if (error.status === 401 || error.status === 403) removeStorage(window.sessionStorage, ADMIN_SESSION_KEY);
            notify(text('product.deleteFailed'), 'error');
        }
    }

    function handleAction(actionElement) {
        const { action } = actionElement.dataset;
        if (action === 'home') void navigateTo('home');
        else if (action === 'collection') void navigateTo('collection');
        else if (action === 'about') void navigateTo('about');
        else if (action === 'login') void navigateTo('login');
        else if (action === 'cart') setModalOpen('cartModal', true);
        else if (action === 'close-cart') setModalOpen('cartModal', false);
        else if (action === 'checkout') openCheckout();
        else if (action === 'close-checkout') setModalOpen('checkoutModal', false);
        else if (action === 'language') updateLanguage(state.language === 'ar' ? 'en' : 'ar');
        else if (action === 'theme') setTheme(!state.dark);
        else if (action === 'product') openProductDetails(actionElement.dataset.productId);
        else if (action === 'add-product') {
            const watch = state.watches.find((item) => item._id === actionElement.dataset.productId);
            addToCart(watch);
        } else if (action === 'add-detail') addToCart(state.selectedWatch);
        else if (action === 'thumbnail') {
            const mainImage = byId('pageMainImg');
            if (mainImage && safeImageUrl(actionElement.dataset.imageUrl)) mainImage.src = actionElement.dataset.imageUrl;
            document.querySelectorAll('.thumb-img').forEach((thumb) => thumb.classList.toggle('active', thumb === actionElement));
        } else if (action === 'quantity') {
            changeQuantity(Number(actionElement.dataset.index), Number(actionElement.dataset.delta));
        } else if (action === 'remove-cart-item') {
            const index = Number(actionElement.dataset.index);
            if (Number.isInteger(index) && state.cart[index]) {
                state.cart.splice(index, 1);
                saveCart();
            }
        } else if (action === 'admin-logout') logoutAdmin();
        else if (action === 'refresh-orders') void fetchAdminOrders();
        else if (action === 'delete-watch') void deleteWatch(actionElement.dataset.productId);
        else if (action === 'remove-image') {
            const index = Number(actionElement.dataset.index);
            if (Number.isInteger(index) && state.productImages[index]) {
                state.productImages.splice(index, 1);
                updateImagePreviews();
            }
        }
    }

    function handleBackdropClick(event) {
        const target = event.target;
        if (target instanceof HTMLElement && target.classList.contains('modal-overlay')) {
            setModalOpen(target.id, false);
        }
    }

    function onKeyDown(event) {
        if (event.key === 'Escape') {
            setModalOpen('cartModal', false);
            setModalOpen('checkoutModal', false);
        }
    }

    function initialize() {
        removeStorage(window.localStorage, 'waqt_admin_token');
        state.cart = loadCartFromStorage();
        const savedLanguage = readStorage(window.localStorage, LANGUAGE_STORAGE_KEY);
        updateLanguage(savedLanguage === 'en' ? 'en' : 'ar');
        setTheme(readStorage(window.localStorage, THEME_STORAGE_KEY) === 'dark');
        renderCart();

        const preloader = byId('preloader');
        window.addEventListener('load', () => {
            if (preloader) window.setTimeout(() => preloader.classList.add('hidden-loader'), 250);
            if (window.AOS && typeof window.AOS.init === 'function') {
                window.AOS.init({ duration: 800, once: true, offset: 50 });
            }
        }, { once: true });

        document.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            const actionElement = target.closest('[data-action]');
            if (actionElement) handleAction(actionElement);
            const authTab = target.closest('[data-auth-tab]');
            if (authTab) toggleAuthTab(authTab.dataset.authTab);
            const adminTab = target.closest('[data-admin-tab]');
            if (adminTab) void switchAdminTab(adminTab.dataset.adminTab);
        });
        document.addEventListener('click', handleBackdropClick);
        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('scroll', () => {
            const nav = byId('mainNav');
            if (nav) nav.classList.toggle('scrolled', window.scrollY > 30);
        }, { passive: true });

        byId('checkoutForm').addEventListener('submit', submitOrder);
        byId('loginForm').addEventListener('submit', handleLogin);
        byId('registerForm').addEventListener('submit', handleRegister);
        byId('addWatchForm').addEventListener('submit', handleAddWatch);
        byId('fileInput').addEventListener('change', (event) => handleImageFiles(event.currentTarget.files));
        byId('cPayment').addEventListener('change', (event) => {
            byId('codNote').classList.toggle('hidden', event.currentTarget.value !== 'cod');
        });

        showSection(['home', 'collection', 'about', 'whyChooseUs']);
        void loadPublicWatches();
    }

    window.loadPublicWatches = loadPublicWatches;
    window.navigateTo = navigateTo;
    window.toggleLanguage = () => updateLanguage(state.language === 'ar' ? 'en' : 'ar');
    window.toggleTheme = () => setTheme(!state.dark);
    window.toggleCartModal = () => setModalOpen('cartModal', !byId('cartModal').classList.contains('active'));
    window.openCheckoutModal = openCheckout;
    window.closeModal = (modalId) => setModalOpen(modalId, false);
    window.fetchAdminOrders = fetchAdminOrders;
    window.fetchAdminWatches = fetchAdminWatches;
    window.switchAdminTab = switchAdminTab;
    window.adminLogout = logoutAdmin;
    window.handleAddWatch = handleAddWatch;
    window.deleteWatch = deleteWatch;
    window.addToCartFromDetails = () => addToCart(state.selectedWatch);
    window.openProductDetails = openProductDetails;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
