/* Utilidades mínimas de DOM.
   Todo se construye con createElement en vez de innerHTML: no hay forma de
   inyectar HTML desde un campo de texto, así que el XSS deja de existir. */

window.PL = window.PL || {};

(function (PL) {
    'use strict';

    function append(parent, child) {
        if (child === null || child === undefined || child === false) return;
        if (Array.isArray(child)) {
            child.forEach(function (c) { append(parent, c); });
            return;
        }
        parent.appendChild(child.nodeType ? child : document.createTextNode(String(child)));
    }

    /**
     * h('input', { class: 'input', value: 'x', dataset: { path: 'a.b' } }, [hijos])
     */
    function h(tag, props, children) {
        var el = document.createElement(tag);

        Object.keys(props || {}).forEach(function (key) {
            var value = props[key];
            if (value === null || value === undefined || value === false) return;

            if (key === 'class') el.className = value;
            else if (key === 'text') el.textContent = value;
            else if (key === 'dataset') Object.keys(value).forEach(function (k) { el.dataset[k] = value[k]; });
            else if (key === 'style') Object.keys(value).forEach(function (k) { el.style[k] = value[k]; });
            else if (key.indexOf('on') === 0) el.addEventListener(key.slice(2), value);
            else if (key in el) el[key] = value;
            else el.setAttribute(key, value);
        });

        append(el, children);
        return el;
    }

    function frag(children) {
        var f = document.createDocumentFragment();
        append(f, children);
        return f;
    }

    function replace(host, children) {
        host.textContent = '';
        append(host, children);
    }

    function $(selector, scope) {
        return (scope || document).querySelector(selector);
    }

    function $$(selector, scope) {
        return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
    }

    PL.h = h;
    PL.frag = frag;
    PL.replace = replace;
    PL.$ = $;
    PL.$$ = $$;
})(window.PL);
