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
                setTimeout(function () { b.textContent = 'اشتراک‌گذاری'; }, 2000);
            });
        }
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
    $('editBtn').addEventListener('click', function () {
        $('form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    try {
        var saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
        if (saved) { writeInputs(saved); calculate(false); }
    } catch (e) {}
})();
