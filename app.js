(function () {
    var MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
        'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    var STORE_KEY = 'eoth-inputs';
    var DAY = 864e5;
    var RING_LEN = 2 * Math.PI * 88;

    var $ = function (id) { return document.getElementById(id); };
    var fa = function (n, digits) {
        return Number(n).toLocaleString('fa-IR', {
            minimumFractionDigits: digits || 0,
            maximumFractionDigits: digits || 0
        });
    };

    var state = null;
    var timer = null;

    // ---------- fill selects ----------
    function option(sel, value, text) {
        var o = document.createElement('option');
        o.value = value;
        o.textContent = text;
        sel.appendChild(o);
    }

    function fillSelects() {
        var d = $('startDay'), m = $('startMonth'), y = $('startYear');
        option(d, '', 'روز'); option(m, '', 'ماه'); option(y, '', 'سال');
        [d, m, y].forEach(function (s) { s.options[0].disabled = true; s.options[0].selected = true; });
        for (var i = 1; i <= 31; i++) option(d, i, fa(i));
        MONTHS.forEach(function (name, i) { option(m, i + 1, name); });
        var now = new Date();
        var thisYear = gregorian_to_jalali(now.getFullYear(), now.getMonth() + 1, now.getDate())[0];
        for (var yr = thisYear + 1; yr >= 1390; yr--) option(y, yr, fa(yr).replace(/٬/g, ''));
    }

    // ---------- helpers ----------
    function jalaliToDate(jy, jm, jd) {
        var g = jalali_to_gregorian(jy, jm, jd);
        return new Date(g[0], g[1] - 1, g[2], 0, 0, 0);
    }

    function jalaliLabel(y, m, d) {
        return fa(d) + ' ' + MONTHS[m - 1] + ' ' + fa(y).replace(/٬/g, '');
    }

    function countFridays(from, to) {
        if (to <= from) return 0;
        var days = Math.floor((to - from) / DAY);
        var full = Math.floor(days / 7);
        var extra = days % 7;
        var dow = from.getDay();
        var count = full;
        for (var i = 1; i <= extra; i++) if ((dow + i) % 7 === 5) count++;
        return count;
    }

    function readInputs() {
        var len = document.querySelector('input[name=lengthOfHell]:checked');
        return {
            d: parseInt($('startDay').value, 10),
            m: parseInt($('startMonth').value, 10),
            y: parseInt($('startYear').value, 10),
            len: len ? parseInt(len.value, 10) : 21,
            kasri: parseInt($('kasriKhedmat').value, 10) || 0,
            ezafe: parseInt($('ezafeKhedmat').value, 10) || 0
        };
    }

    function writeInputs(v) {
        if (v.d) $('startDay').value = v.d;
        if (v.m) $('startMonth').value = v.m;
        if (v.y) $('startYear').value = v.y;
        var r = $('len' + v.len);
        if (r) r.checked = true;
        if (v.kasri) $('kasriKhedmat').value = v.kasri;
        if (v.ezafe) $('ezafeKhedmat').value = v.ezafe;
    }

    function mood(p) {
        if (p >= 100) return ['ترخیص شدی! مبارکه 🎉', 'به دنیای آزاد خوش اومدی، دیگه کسی بهت نمی‌گه «خبردار»'];
        if (p >= 90) return ['بوی ترخیص میاد... 🎓', 'کارت پایان خدمت تو راهه، فقط یه کم دیگه'];
        if (p >= 75) return ['دیگه پیرمرد گروهانی 👴', 'نوجوونا باید بهت احترام بذارن'];
        if (p >= 50) return ['از نصف رد شدی! 💪', 'از اینجا به بعد سرپایینیه'];
        if (p >= 25) return ['داری جا میفتی 🫡', 'سلام نظامیت دیگه حرفه‌ای شده'];
        if (p >= 10) return ['هنوز اول راهی 🥾', 'پوتین‌هات تازه دارن نرم می‌شن'];
        return ['خوش اومدی سرباز! 🪖', 'هنوز بوی آموزشی میدی، صبور باش'];
    }

    // ---------- render ----------
    function tick() {
        if (!state) return;
        var now = new Date();
        var total = state.exit - state.start;
        var done = Math.min(Math.max(now - state.start, 0), total);
        var left = Math.max(state.exit - now, 0);
        var pct = total > 0 ? done / total * 100 : 100;

        $('pct').innerHTML = fa(pct, pct >= 100 ? 0 : 1) + '<small>٪</small>';

        var s = Math.floor(left / 1000);
        $('cdD').textContent = fa(Math.floor(s / 86400));
        $('cdH').textContent = fa(Math.floor(s % 86400 / 3600));
        $('cdM').textContent = fa(Math.floor(s % 3600 / 60));
        $('cdS').textContent = fa(s % 60);

        $('left_days').textContent = fa(done / DAY, 1);
        $('left_weeks').textContent = fa(done / DAY / 7, 1);
        $('left_months').textContent = fa(done / DAY / 30, 1);
        $('left_hours').textContent = fa(done / 36e5, 0);
        $('left_minutes').textContent = fa(done / 6e4, 0);
        $('left_seconds').textContent = fa(done / 1e3, 0);

        $('remain_days').textContent = fa(left / DAY, 1);
        $('remain_weeks').textContent = fa(left / DAY / 7, 1);
        $('remain_months').textContent = fa(left / DAY / 30, 1);
        $('remain_hours').textContent = fa(left / 36e5, 0);
        $('remain_minutes').textContent = fa(left / 6e4, 0);
        $('remain_seconds').textContent = fa(left / 1e3, 0);

        state.pct = pct;
        state.leftDays = Math.ceil(left / DAY);
    }

    function render() {
        var now = new Date();
        var total = state.exit - state.start;
        var pct = Math.min(Math.max((now - state.start) / total * 100, 0), 100);

        var md = mood(pct);
        $('mood').textContent = md[0];
        $('moodSub').textContent = md[1];
        $('tarkhis_date').textContent = jalaliLabel(state.ey, state.em, state.ed);
        $('startLabel').textContent = jalaliLabel(state.y, state.m, state.d);

        var doneDays = Math.max(Math.floor((now - state.start) / DAY), 0);
        $('funMeals').textContent = fa(Math.min(doneDays, Math.floor(total / DAY)) * 3);
        $('funNights').textContent = fa(Math.max(Math.ceil((state.exit - now) / DAY), 0));
        $('funFridays').textContent = fa(countFridays(now, state.exit));

        var res = $('result');
        res.classList.remove('show');
        void res.offsetWidth;
        res.classList.add('show');

        var bar = $('ringBar');
        bar.style.strokeDasharray = RING_LEN;
        bar.style.strokeDashoffset = RING_LEN;
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                bar.style.strokeDashoffset = RING_LEN * (1 - pct / 100);
                $('tlFill').style.width = pct + '%';
                $('tlSoldier').style.right = pct + '%';
                $('tlSoldier').textContent = pct >= 100 ? '🎓' : '🪖';
            });
        });

        tick();
        clearInterval(timer);
        timer = setInterval(tick, 1000);

        if (pct >= 100) confetti();
    }

    function calculate(scroll) {
        var v = readInputs();
        var err = $('result_error');

        if (!v.d || !v.m || !v.y || (v.m > 6 && v.d > 30)) {
            err.style.display = 'block';
            $('result').classList.remove('show');
            return;
        }

        // reuse the original exit-date logic from eoth2.js
        var diff = v.kasri - v.ezafe;
        var abs = Math.abs(diff), sign = diff < 0 ? -1 : 1;
        var dY = Math.floor(abs / 360) * sign;
        var dM = Math.floor(abs % 360 / 30) * sign;
        var dD = Math.floor(abs % 360 % 30) * sign;
        if (!isValid_lengthOfHell(v.len)) { err.style.display = 'block'; return; }
        var ex = calculate_ExitDates(v.d, v.m, v.y, dD, dM, dY, v.len);

        var start = jalaliToDate(v.y, v.m, v.d);
        var exit = jalaliToDate(ex.exitYear, ex.exitMonth, ex.exitDay);

        if (start > new Date() || exit <= start) {
            err.style.display = 'block';
            $('result').classList.remove('show');
            return;
        }

        err.style.display = 'none';
        state = {
            d: v.d, m: v.m, y: v.y,
            ed: ex.exitDay, em: ex.exitMonth, ey: ex.exitYear,
            start: start, exit: exit
        };
        try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch (e) {}
        render();
        if (scroll) $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ---------- share ----------
    function share() {
        if (!state) return;
        var text = state.pct >= 100
            ? 'من ترخیص شدم! 🎉'
            : '🪖 ' + fa(state.pct, 1) + '٪ از خدمتم گذشته و ' + fa(state.leftDays) + ' روز دیگه ترخیص می‌شم!';
        text += '\nروزشمار سربازی: https://endofthehell.ir';
        if (navigator.share) {
            navigator.share({ text: text }).catch(function () {});
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function () {
                var b = $('shareBtn');
                b.textContent = 'کپی شد ✓';
                setTimeout(function () { b.textContent = 'اشتراک‌گذاری متن'; }, 2000);
            });
        }
    }

    // ---------- share image ----------
    var imgBlob = null;

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function drawShareImage() {
        var W = 1080, H = 1920, F = 'Vazir, Tahoma, sans-serif';
        var c = document.createElement('canvas');
        c.width = W; c.height = H;
        var ctx = c.getContext('2d');
        ctx.direction = 'rtl';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        var now = new Date();
        var total = state.exit - state.start;
        var pct = Math.min(Math.max((now - state.start) / total * 100, 0), 100);
        var leftDays = Math.max(Math.ceil((state.exit - now) / DAY), 0);
        var doneDays = Math.max(Math.floor((now - state.start) / DAY), 0);
        var finished = pct >= 100;

        // background
        var bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#232a1a');
        bg.addColorStop(1, '#0f120c');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // camo blobs
        var blobs = [[150, 260, 260, 150, '#6b7a3c'], [880, 180, 200, 300, '#4a5229'],
            [620, 980, 340, 170, '#8a7a4a'], [200, 1350, 220, 260, '#4a5229'],
            [920, 1620, 300, 160, '#6b7a3c'], [480, 520, 180, 110, '#8a7a4a'],
            [90, 1800, 260, 140, '#8a7a4a']];
        ctx.globalAlpha = .1;
        blobs.forEach(function (b, i) {
            ctx.fillStyle = b[4];
            ctx.beginPath();
            ctx.ellipse(b[0], b[1], b[2], b[3], i * .6, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // hazard stripes top & bottom
        function stripes(y) {
            ctx.save();
            ctx.beginPath(); ctx.rect(0, y, W, 22); ctx.clip();
            ctx.fillStyle = '#2b3120'; ctx.fillRect(0, y, W, 22);
            ctx.fillStyle = '#c8b273';
            for (var x = -40; x < W + 40; x += 44) {
                ctx.beginPath();
                ctx.moveTo(x, y + 22); ctx.lineTo(x + 22, y + 22);
                ctx.lineTo(x + 44, y); ctx.lineTo(x + 22, y);
                ctx.fill();
            }
            ctx.restore();
        }
        stripes(0); stripes(H - 22);

        // header
        ctx.fillStyle = '#a9a58f';
        ctx.font = '36px ' + F;
        ctx.fillText('🪖  گزارش وضعیت سرباز', W / 2, 150);
        ctx.font = '96px ' + F;
        ctx.fillStyle = '#e6d7a3';
        ctx.fillText('روزشمار سربازی', W / 2, 260);

        // ring
        var cx = W / 2, cy = 680, r = 290;
        ctx.lineWidth = 46;
        ctx.strokeStyle = 'rgba(255,255,255,.08)';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        var g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        g.addColorStop(0, '#9bb04f'); g.addColorStop(1, '#e6d7a3');
        ctx.strokeStyle = g;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(pct, .5) / 100);
        ctx.stroke();

        ctx.fillStyle = '#e6d7a3';
        ctx.font = '170px ' + F;
        ctx.fillText(fa(pct, finished ? 0 : 1) + '٪', cx, cy - 10);
        ctx.fillStyle = '#a9a58f';
        ctx.font = '40px ' + F;
        ctx.fillText('از خدمت گذشته', cx, cy + 120);

        // mood
        var md = mood(pct);
        ctx.fillStyle = '#eee8d5';
        ctx.font = '62px ' + F;
        ctx.fillText(md[0], W / 2, 1090);
        ctx.fillStyle = '#a9a58f';
        ctx.font = '38px ' + F;
        ctx.fillText(md[1], W / 2, 1170);

        // stat boxes
        function box(x, val, label, color) {
            ctx.fillStyle = 'rgba(0,0,0,.35)';
            roundRect(ctx, x, 1250, 440, 220, 36); ctx.fill();
            ctx.strokeStyle = 'rgba(200,178,115,.25)'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = color;
            ctx.font = '96px ' + F;
            ctx.fillText(val, x + 220, 1340);
            ctx.fillStyle = '#a9a58f';
            ctx.font = '36px ' + F;
            ctx.fillText(label, x + 220, 1425);
        }
        box(560, fa(doneDays), 'روز خدمت کردم', '#9bb04f');
        box(80, fa(leftDays), finished ? 'روز مونده! 🎉' : 'روز مونده', '#e6d7a3');

        // dog tag
        var tx = 140, ty = 1530, tw = 800, th = 150;
        var tg = ctx.createLinearGradient(tx, ty, tx + tw, ty + th);
        tg.addColorStop(0, '#d8d4c8'); tg.addColorStop(1, '#9c998e');
        ctx.fillStyle = tg;
        roundRect(ctx, tx, ty, tw, th, 75); ctx.fill();
        ctx.fillStyle = '#0f120c';
        ctx.beginPath(); ctx.arc(tx + 60, ty + th / 2, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#23261d';
        ctx.textAlign = 'right';
        ctx.font = '34px ' + F;
        ctx.fillText('روز ترخیص', tx + tw - 50, ty + th / 2);
        ctx.textAlign = 'left';
        ctx.font = '58px ' + F;
        ctx.fillText(jalaliLabel(state.ey, state.em, state.ed), tx + 110, ty + th / 2 + 4);

        // footer
        ctx.textAlign = 'center';
        ctx.fillStyle = '#c8b273';
        ctx.font = '40px ' + F;
        ctx.fillText('endofthehell.ir', W / 2, 1800);
        ctx.fillStyle = '#6f6c5c';
        ctx.font = '30px ' + F;
        ctx.fillText('روزت رو حساب کن 👆', W / 2, 1855);

        return c;
    }

    var imgDataUrl = null;

    function dataUrlToBlob(url) {
        var parts = url.split(','), bin = atob(parts[1]), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: 'image/png' });
    }

    function imgStatus(msg) {
        var el = $('imgStatus');
        el.textContent = msg || '';
        el.style.display = msg ? 'block' : 'none';
    }

    function openImage() {
        if (!state) return;
        var modal = $('imgModal'), img = $('imgPreview');
        imgBlob = null; imgDataUrl = null;
        img.removeAttribute('src');
        imgStatus('');
        $('imgLoading').style.display = 'block';
        modal.classList.add('open');
        var ready = Promise.resolve();
        try {
            if (document.fonts && document.fonts.load) {
                ready = Promise.race([
                    document.fonts.load('40px Vazir'),
                    new Promise(function (r) { setTimeout(r, 1500); })
                ]).catch(function () {});
            }
        } catch (e) {}
        ready.then(function () {
            try {
                // data URL works everywhere (also for long-press "save image" in in-app browsers)
                imgDataUrl = drawShareImage().toDataURL('image/png');
                imgBlob = dataUrlToBlob(imgDataUrl);
                img.src = imgDataUrl;
            } catch (e) {
                imgStatus('ساخت عکس روی این مرورگر ممکن نشد 😕');
            }
            $('imgLoading').style.display = 'none';
        });
    }

    function downloadImage() {
        if (!imgDataUrl) return;
        var a = document.createElement('a');
        a.href = imgDataUrl;
        a.download = 'sarbazi.png';
        if (!('download' in a)) {
            imgStatus('روی عکس انگشتت رو نگه دار و «ذخیره عکس» رو بزن');
            return;
        }
        document.body.appendChild(a);
        a.click();
        a.remove();
        imgStatus('اگه دانلود نشد، روی عکس انگشتت رو نگه دار و «ذخیره عکس» رو بزن');
    }

    function shareImage() {
        if (!imgBlob) return;
        var file;
        try { file = new File([imgBlob], 'sarbazi.png', { type: 'image/png' }); } catch (e) { file = null; }
        var data = file ? { files: [file] } : null;
        var can = false;
        try { can = !!(data && navigator.share && navigator.canShare && navigator.canShare(data)); } catch (e) {}
        if (!can) {
            downloadImage();
            imgStatus('مرورگرت اشتراک مستقیم عکس رو پشتیبانی نمی‌کنه؛ عکس رو ذخیره کن و توی استوری بذار. (توی تلگرام/اینستاگرام، سایت رو با Chrome یا Safari باز کن)');
            return;
        }
        navigator.share(data).catch(function (err) {
            if (err && err.name === 'AbortError') return; // user closed the share sheet
            downloadImage();
        });
    }

    // ---------- confetti ----------
    function confetti() {
        if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        var c = $('confetti'), ctx = c.getContext('2d');
        c.width = innerWidth; c.height = innerHeight;
        var colors = ['#c8b273', '#9bb04f', '#e6d7a3', '#6b7a3c', '#ffffff', '#c9604a'];
        var parts = [];
        for (var i = 0; i < 180; i++) {
            parts.push({
                x: Math.random() * c.width, y: -20 - Math.random() * c.height * .5,
                w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
                vx: -2 + Math.random() * 4, vy: 2 + Math.random() * 4,
                r: Math.random() * 6, vr: -.2 + Math.random() * .4,
                c: colors[i % colors.length]
            });
        }
        var frames = 0;
        (function loop() {
            ctx.clearRect(0, 0, c.width, c.height);
            parts.forEach(function (p) {
                p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vy += .03;
                ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
                ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            });
            if (++frames < 360) requestAnimationFrame(loop);
            else ctx.clearRect(0, 0, c.width, c.height);
        })();
    }

    // ---------- init ----------
    fillSelects();
    $('form').addEventListener('submit', function () { calculate(true); });
    $('shareBtn').addEventListener('click', share);
    $('imageBtn').addEventListener('click', openImage);
    $('imgShare').addEventListener('click', shareImage);
    $('imgDownload').addEventListener('click', downloadImage);
    $('imgClose').addEventListener('click', function () { $('imgModal').classList.remove('open'); });
    $('imgModal').addEventListener('click', function (e) {
        if (e.target === this) this.classList.remove('open');
    });
    $('editBtn').addEventListener('click', function () {
        $('form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    try {
        var saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
        if (saved) { writeInputs(saved); calculate(false); }
    } catch (e) {}
})();
