/* Pragmatic.js (standalone UMD) */
/* eslint-disable no-unused-vars, no-undef */
(function (global) {
  'use strict';

  // =========================
  // Utilities + Globals
  // =========================
  const Fragment = Symbol("Fragment");

  function reactive(obj, callback) {
    return new Proxy(obj, {
      set(target, key, value) {
        if (target[key] === value) return true;
        target[key] = value;
        callback(key, value);
        return true;
      }
    });
  }

  function parseCondition(condition) {
    const match = condition.match(/([a-zA-Z0-9_]+)\s*(==|!=|~=|>=|<=|>|<|matches)\s*(\/.*\/|.+)/);
    return match ? [match[1], match[2], match[3]] : [condition, '', ''];
  }

  // Forward declarations (filled in after State exists)
  let updateVisibility, updateClasses, updateDOM, bindInputs, trackOnShowElements, evaluateCondition;

  // =========================
  // State Singleton
  // =========================
  class StateSingleton {
    constructor() {
      if (!StateSingleton.instance) {
        let storedData;
        try {
          storedData = JSON.parse(localStorage.getItem("state")) || {};
        } catch(_) {
          storedData = {};
        }

        // Add PWA-specific initial state
        storedData.pwaInstallPrompt = null;
        storedData.showInstallButton = false;

        this.data = reactive(storedData, this.updateLocalStorage.bind(this));
        bindInputs(this.data);
        this.subscribers = {};
        StateSingleton.instance = this;

        // Initialize route state - include both pathname and hash
        this.data.route = window.location.pathname + window.location.hash;

        // Initialize PWA functionality (guarded by flag)
        this.initPWA();

        requestAnimationFrame(() => {
          Object.keys(this.data).forEach((key) => updateDOM(key, this.data[key]));
          updateVisibility();
          updateClasses();
        });
      }
      return StateSingleton.instance;
    }

    updateLocalStorage(key, value) {
      try {
        localStorage.setItem("state", JSON.stringify(this.data));
      } catch(_) {/* ignore quota or private mode */}
      updateDOM(key, value);
      updateVisibility();
      updateClasses();
    }

    set(properties) {
      Object.entries(properties).forEach(([key, value]) => {
        this.data[key] = value;
        if (this.subscribers[key]) this.subscribers[key].forEach(cb => cb(value));
      });
      requestAnimationFrame(updateVisibility);
      requestAnimationFrame(updateClasses);
    }

    get(key) { return this.data[key]; }
    getData() { return this.data; }

    forceRender(componentId = 'default') {
      const renderKey = `__render_${componentId}_${Date.now()}`;
      this.data[renderKey] = true;
      setTimeout(() => { delete this.data[renderKey]; }, 100);
    }

    subscribe(key, callback) {
      if (!this.subscribers[key]) this.subscribers[key] = [];
      this.subscribers[key].push(callback);
      callback(this.data[key]);
      return () => {
        this.subscribers[key] = this.subscribers[key].filter(cb => cb !== callback);
      };
    }

    initPWA() {
      // No-op unless enabled explicitly (e.g., on your own domain)
      if (!global.Pragmatic || !global.Pragmatic.enablePWA) return;

      // Check if already running as installed PWA
      if (window.matchMedia('(display-mode: standalone)').matches ||
          window.navigator.standalone === true) {
        this.data.showInstallButton = false;
      }

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.data.pwaInstallPrompt = e;
        this.data.showInstallButton = true;
      });

      window.addEventListener('appinstalled', () => {
        this.data.pwaInstallPrompt = null;
        this.data.showInstallButton = false;
      });

      if ('serviceWorker' in navigator && global.Pragmatic.enablePWA) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js')
            .catch(() => {/* ignore for demos */});
        });
      }
    }

    async triggerInstall() {
      if (this.data.pwaInstallPrompt) {
        try {
          this.data.pwaInstallPrompt.prompt();
          const { outcome } = await this.data.pwaInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            this.data.pwaInstallPrompt = null;
            this.data.showInstallButton = false;
          }
        } catch (e) {/* swallow for demo */}
      }
    }

    reset(initialState = {}) {
      Object.keys(this.data).forEach(key => delete this.data[key]);
      this.subscribers = {};
      Object.assign(this.data, initialState);

      document.querySelectorAll("[data-bind], [show-if], [class-if]").forEach(el => {
        const bindKey = el.getAttribute("data-bind");
        const showIf = el.getAttribute("show-if");
        const classIf = el.getAttribute("class-if");

        if (bindKey) {
          if (el.tagName === "INPUT") {
            if (el.type === "checkbox" || el.type === "radio") {
              el.checked = !!initialState[bindKey];
            } else {
              el.value = initialState[bindKey] || "";
            }
          } else if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
            el.value = initialState[bindKey] || "";
          } else {
            el.textContent = initialState[bindKey] || "";
          }
        }

        if (showIf && typeof this.data[showIf] === "function") {
          el.style.display = this.data[showIf]() ? "" : "none";
        }

        if (classIf && typeof this.data[classIf] === "function") {
          el.className = this.data[classIf]() || "";
        }
      });
    }
  }

  

  // =========================
  // DOM helpers now that State exists
  // =========================
  evaluateCondition = function (condition) {
    return condition.split(/\s*\|\|\s*/).some(orPart =>
      orPart.split(/\s*&&\s*/).every(andPart =>
        (function evaluateSingleCondition(cond) {
          let match = false;
          let stateKey, operator, expectedValue;

          if (cond.startsWith("!")) return !State.get(cond.substring(1).trim());

          if (cond.startsWith("route~=")) {
            return String(State.get("route") || "").startsWith(cond.replace("route~=", "").trim());
          }
          if (cond.startsWith("route==")) {
            const expectedRoute = cond.replace("route==", "").trim();
            const currentRoute = String(State.get("route") || "");
            return currentRoute === expectedRoute || currentRoute.startsWith(expectedRoute + "#");
          }
          if (cond.startsWith("route!=")) {
            const expectedRoute = cond.replace("route!=", "").trim();
            const currentRoute = String(State.get("route") || "");
            return currentRoute !== expectedRoute && !currentRoute.startsWith(expectedRoute + "#");
          }
          if (cond.startsWith("route#=")) {
            const expectedRoute = cond.replace("route#=", "").trim();
            const currentRoute = String(State.get("route") || "");
            return currentRoute.includes("#") && currentRoute.startsWith(expectedRoute + "#");
          }

          if (!/[=<>!~]|matches/.test(cond)) return !!State.get(cond);

          [stateKey, operator, expectedValue] = parseCondition(cond);
          const stateValue = State.get(stateKey.trim());

          if (operator === "matches") {
            try {
              const regexPattern = expectedValue.trim().replace(/^\/|\/$/g, "");
              const regex = new RegExp(regexPattern);
              match = regex.test(stateValue);
            } catch (e) { match = false; }
          } else {
            switch (operator) {
              case "==": match = stateValue == expectedValue.trim(); break;
              case "!=": match = stateValue != expectedValue.trim(); break;
              case "~=": match = typeof stateValue === "string" && stateValue.includes(expectedValue.trim()); break;
              case ">":  match = parseFloat(stateValue) >  parseFloat(expectedValue); break;
              case "<":  match = parseFloat(stateValue) <  parseFloat(expectedValue); break;
              case ">=": match = parseFloat(stateValue) >= parseFloat(expectedValue); break;
              case "<=": match = parseFloat(stateValue) <= parseFloat(expectedValue); break;
            }
          }
          return match;
        })(andPart.trim())
      )
    );
  };

  updateClasses = function() {
    document.querySelectorAll("[class-if]").forEach((element) => {
      const classRules = element.getAttribute("class-if").split(";").map(rule => rule.trim()).filter(Boolean);

      classRules.forEach(rule => {
        let match;
        if (rule.includes("?")) {
          const [condition, classes] = rule.split("?").map(s => s.trim());
          const [trueClass, falseClass] = classes.split(":").map(s => s.trim());
          match = evaluateCondition(condition);
          if (trueClass) element.classList.toggle(trueClass, !!match);
          if (falseClass) element.classList.toggle(falseClass, !match);
        } else if (rule.includes(":")) {
          const [stateKey, className] = rule.split(":").map(s => s.trim());
          match = State.get(stateKey);
          element.classList.toggle(className, !!match);
        }
      });
    });
  }

  updateDOM = function(key, value) {
    const elements = document.querySelectorAll(`[data-bind="${key}"]`);
    elements.forEach(element => {
      const tag = element.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (element.type === 'checkbox') {
          element.checked = Boolean(value);
        } else if (element.type === 'radio') {
          element.checked = (element.value === value);
        } else {
          element.value = value ?? '';
        }
      } else {
        element.textContent = value;
      }
    });
    requestAnimationFrame(updateVisibility);
    requestAnimationFrame(updateClasses);
  }

  bindInputs = function(data) {
    document.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const key = target.getAttribute("data-bind");
      if (!key) return;

      if (target.type === "checkbox") {
        data[key] = target.checked;
        updateDOM(key, target.checked);
      } else {
        data[key] = target.value;
        updateDOM(key, target.value);
      }
      updateVisibility();
      updateClasses();
    });
  }

  trackOnShowElements = function() {
    const elements = document.querySelectorAll("[onShow]");
    elements.forEach((element) => {
      if (!element.__onShowObserver) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              try { element.onShow && element.onShow(); } catch (e) {}
            }
          });
        });
        observer.observe(element);
        element.__onShowObserver = observer;
      }
    });
  }

  updateVisibility = function () {
    document.querySelectorAll("[show-if]").forEach((element) => {
      const condition = element.getAttribute("show-if");
      let shouldShow = false;

      if (typeof element.showIf === "function") {
        shouldShow = element.showIf();
      } else if (condition) {
        shouldShow = evaluateCondition(condition.trim());
      }
      element.style.display = shouldShow ? "" : "none";
    });
    requestAnimationFrame(trackOnShowElements);
  };
  const State = new StateSingleton();
  global.State = State; // optional global for quick debugging
  // =========================
  // JSX-like h()
  // =========================
  const h = (tag, props = {}, ...children) => {
    if (typeof tag === "function") {
      const node = tag({
        ...props,
        children,
        route: State.get("route")
      });

      if (node instanceof Node && props) {
        Object.entries(props || {}).forEach(([key, val]) => {
          if (key.startsWith("on") && typeof val === "function") {
            if (key === "onShow") {
              const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => { if (entry.isIntersecting) val(node); });
              }, { threshold: 0.1 });
              requestAnimationFrame(() => { if (document.contains(node)) observer.observe(node); });
              node.onShow = val;
            } else {
              node.addEventListener(key.slice(2).toLowerCase(), val);
            }
          } else if (key === "class-if" && typeof val === "function") {
            const updVis = () => { node.style.display = val() ? "" : "none"; };
            updVis();
            const boundKey = val.toString().match(/State\.get\(["'](.+?)["']\)/);
            if (boundKey && boundKey[1]) State.subscribe(boundKey[1], updVis);

            const updClass = () => { node.className = val() || ""; };
            updClass();
            State.set({ [`__update_${node.tagName?.toLowerCase() || "component"}`]: updClass });
            window.addEventListener("popstate", updClass);
          } else if (key === "show-if" && typeof val === "function") {
            const updVis = () => { node.style.display = val() ? "" : "none"; };
            updVis();
            const boundKey = val.toString().match(/State\.get\(["'](.+?)["']\)/);
            if (boundKey && boundKey[1]) State.subscribe(boundKey[1], updVis);
          } else if (key === "valid-if" && typeof val === "function") {
            node.validIf = val;
          } else {
            node.setAttribute?.(key, val);
          }
        });

        if (node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.tagName === "SELECT") {
          const bindKey = props["data-bind"];
          if (bindKey) {
            const clearInvalidState = () => {
              if (State.get(`${bindKey}_invalid`)) {
                State.set({ [`${bindKey}_invalid`]: undefined });
                State.set({ [`${bindKey}_valid`]: true });
                node.classList.remove('invalid');
              }
            };
            node.addEventListener("input", clearInvalidState);
            node.addEventListener("change", clearInvalidState);
            node.addEventListener("focus", clearInvalidState);
          }
        }

        if (node.tagName === "A") {
          const href = node.getAttribute("href");
          if (href && href.startsWith("/") && !href.startsWith("//")) {
            node.addEventListener("click", (e) => {
              if (!props.onClick || props.onClick(e) !== false) {
                if (href.includes("#")) return;
                e.preventDefault();
                navigate(href);
              }
            });
          }
        }
        node.props = { ...(node.props || {}), ...props };
      }
      return node;
    }

    if (typeof tag === "symbol" && tag.toString() === "Symbol(Fragment)") {
      const fragment = document.createDocumentFragment();
      children.flat().forEach((child) => fragment.append(child));
      return fragment;
    }

    if (typeof tag !== "string") {
      return document.createComment("Invalid component");
    }

    const el = document.createElement(tag);

    Object.entries(props || {}).forEach(([key, val]) => {
      if (key.startsWith("on") && typeof val === "function") {
        if (key === "onShow") {
          const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => { if (entry.isIntersecting) val(el); });
          }, { threshold: 0.1 });
          requestAnimationFrame(() => { if (document.contains(el)) observer.observe(el); });
          el.onShow = val;
        } else if (key === "onClick" && el.tagName === "A") {
          el.addEventListener("click", (e) => { e.preventDefault(); val(e); });
        } else {
          el.addEventListener(key.slice(2).toLowerCase(), val);
        }
      } else if (key === "class-if" && typeof val === "function") {
        const updVis = () => { el.style.display = val() ? "" : "none"; };
        updVis();
        const boundKey = val.toString().match(/State\.get\(["'](.+?)["']\)/);
        if (boundKey && boundKey[1]) State.subscribe(boundKey[1], updVis);

        const updClass = () => { el.className = val() || ""; };
        updClass();
        State.set({ [`__update_${tag}`]: updClass });
        window.addEventListener("popstate", updClass);
      } else if (key === "show-if" && typeof val === "function") {
        const updVis = () => { el.style.display = val() ? "" : "none"; };
        updVis();
        const boundKey = val.toString().match(/State\.get\(["'](.+?)["']\)/);
        if (boundKey && boundKey[1]) State.subscribe(boundKey[1], updVis);
      } else if (key === "valid-if" && typeof val === "function") {
        el.validIf = val;
      } else {
        el.setAttribute(key, val);
      }
    });

    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
      const bindKey = props["data-bind"];
      if (bindKey) {
        const clearInvalidState = () => {
          if (State.get(`${bindKey}_invalid`)) {
            State.set({ [`${bindKey}_invalid`]: undefined });
            State.set({ [`${bindKey}_valid`]: true });
            el.classList.remove('invalid');
          }
        };
        el.addEventListener("input", clearInvalidState);
        el.addEventListener("change", clearInvalidState);
        el.addEventListener("focus", clearInvalidState);
      }
    }

    if (el.tagName === "A") {
      const href = el.getAttribute("href");
      if (href && href.startsWith("/") && !href.startsWith("//")) {
        el.addEventListener("click", (e) => {
          if (!props.onClick || props.onClick(e) !== false) {
            if (href.includes("#")) return;
            e.preventDefault();
            navigate(href);
          }
        });
      }
    }

    children.flat().forEach((child) => {
      if (typeof child === "function") {
        const placeholder = document.createTextNode("");
        el.appendChild(placeholder);

        const render = () => {
          const result = child();
          while (placeholder.nextSibling && placeholder.nextSibling.nodeType !== 8) {
            placeholder.nextSibling.remove();
          }

          if (Array.isArray(result)) {
            const fragment = document.createDocumentFragment();
            result.forEach(item => {
              fragment.appendChild(item instanceof Node ? item : document.createTextNode(String(item)));
            });
            placeholder.after(fragment);
          } else if (typeof result === "string" || typeof result === "number") {
            if (placeholder.nextSibling && placeholder.nextSibling.nodeType === 3) {
              placeholder.nextSibling.textContent = String(result);
            } else {
              placeholder.after(document.createTextNode(String(result)));
            }
          } else if (result instanceof Node) {
            placeholder.after(result);
          } else if (result == null) {
            placeholder.after(document.createComment("No content"));
          } else {
            placeholder.after(document.createTextNode(String(result)));
          }
        };

        const accessedKeys = new Set();
        try {
          const originalGet = State.get;
          State.get = function (key) { accessedKeys.add(key); return originalGet.call(State, key); };
          child();
          State.get = originalGet;
        } catch (e) { /* ignore */ }

        accessedKeys.forEach(key => State.subscribe(key, render));
        render();
      } else if (Array.isArray(child)) {
        child.forEach(item => el.appendChild(item instanceof Node ? item : document.createTextNode(String(item))));
      } else if (typeof child === "string" || typeof child === "number") {
        el.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        el.appendChild(child);
      }
    });

    return el;
  };

  // =========================
  // Router + helpers
  // =========================
  const routes = { '/404': () => h("div", {}, "404 Page not found") };

  const navigate = (path, options = false, replace = false) => {
    const [pathname, hash] = String(path).split('#');
    const fullPath = hash ? `${pathname}#${hash}` : pathname;
    if (fullPath === State.get('route')) return;

    let stateToSet = {};
    let shouldReplace = false;

    if (typeof options === 'object' && options !== null) {
      stateToSet = options; shouldReplace = replace;
    } else if (typeof options === 'boolean') {
      shouldReplace = options;
    }

    State.set({ route: fullPath, ...stateToSet });

    if (!hash) window.scrollTo(0, 0);

    try {
      if (shouldReplace) history.replaceState({ path: fullPath }, "", fullPath);
      else history.pushState({ path: fullPath }, "", fullPath);
    } catch(_) {/* ignore for cross-origin iframes */}
  };

  global.addEventListener("popstate", (event) => {
    navigate((event.state && event.state.path) || "/", true);
  });

  global.addEventListener("hashchange", () => {
    const currentRoute = State.get('route');
    const newRoute = window.location.pathname + window.location.hash;
    if (currentRoute !== newRoute) State.set({ route: newRoute });
  });

  document.addEventListener("DOMContentLoaded", () => {
    navigate(State.get('route') || '/', true);
  });

  // =========================
  // Validation API
  // =========================
  function validate(groupName) {
    const wrapper = document.querySelector(`[group="${groupName}"]`);
    const wrapperFields = wrapper ? [...wrapper.querySelectorAll("input, select, textarea")] : [];
    const directFields = [...document.querySelectorAll(`[group="${groupName}"]:is(input, select, textarea)`)];
    const extraInside = [...document.querySelectorAll(`[group="${groupName}"] input, select, textarea`)];
    const fields = [...new Set([...wrapperFields, ...directFields, ...extraInside])]
      .filter(field => typeof field.validIf === "function");

    let allValid = true;
    let states = {};

    fields.forEach((field) => {
      const fn = field.validIf;
      const bindKey = field.getAttribute("data-bind");
      if (typeof fn === "function" && bindKey) {
        try {
          const isValid = fn();
          field.classList.toggle("valid", isValid);
          field.classList.toggle("invalid", !isValid);
          states[`${bindKey}_valid`] = isValid;
          states[`${bindKey}_invalid`] = !isValid;
          if (!isValid) allValid = false;
        } catch (e) { allValid = false; }
      }
    });

    State.set(states);
    State.set({ [`${groupName}_valid`]: allValid, [`${groupName}_invalid`]: !allValid });
    return allValid;
  }

  function resetValidation(groupName) {
    const wrapper = document.querySelector(`[group="${groupName}"]`);
    const wrapperFields = wrapper ? [...wrapper.querySelectorAll("input, select, textarea")] : [];
    const directFields = [...document.querySelectorAll(`[group="${groupName}"]:is(input, select, textarea)`)];
    const extraInside = [...document.querySelectorAll(`[group="${groupName}"] input, select, textarea`)];
    const fields = [...new Set([...wrapperFields, ...directFields, ...extraInside])];

    let states = {};
    fields.forEach((field) => {
      const bindKey = field.getAttribute("data-bind");
      if (bindKey) {
        states[`${bindKey}_valid`] = undefined;
        states[`${bindKey}_invalid`] = undefined;
        field.classList.remove("valid", "invalid");
      }
    });

    State.set(states);
    State.set({ [`${groupName}_valid`]: undefined, [`${groupName}_invalid`]: undefined });
  }

  // =========================
  // Link component
  // =========================
  const Link = (props, ...children) => {
    const { href, ...otherProps } = props || {};
    return h("a", { href, ...otherProps }, ...children);
  };

  // =========================
  // Public API (UMD export)
  // =========================
  const Pragmatic = {
    // core
    h, Fragment, reactive,
    // state
    State,
    // router
    navigate, routes,
    // validation
    validate, resetValidation,
    // components
    Link,
    // options
    enablePWA: false // opt-in on real sites
  };

  // expose
  global.Pragmatic = Pragmatic;
  if (typeof module !== 'undefined' && module.exports) module.exports = Pragmatic;
  else if (typeof define === 'function' && define.amd) define(() => Pragmatic);

})(typeof window !== 'undefined' ? window : this);
