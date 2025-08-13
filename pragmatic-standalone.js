/**
 * Pragmatic.js - A lightweight state management and UI rendering library.
 * Standalone version for use as a script include with JSX support.
 * 
 * Usage:
 * <script src="pragmatic-standalone.js"></script>
 * 
 * Features:
 * - Reactive state management
 * - JSX-like rendering with h() function
 * - JSX transformation support for CodePen
 * - Routing
 * - Form validation
 * - PWA support
 * - localStorage persistence
 */

(function() {
  'use strict';

  // Check if already loaded
  if (window.Pragmatic) {
    console.warn('Pragmatic.js already loaded');
    return;
  }

  // Create global namespace
  window.Pragmatic = {};

  // Copy the source code here, but remove export statements
  /**
 * Pragmatic.js - A lightweight state management and UI rendering library.
 *
 * Provides reactive state management, JSX-like rendering, routing, and form validation.
 * State is stored in localStorage for persistence across sessions.
 */

/**
 * Singleton class for state management.
 * Manages reactive data, subscriptions, and automatic updates to the DOM.
 */
class StateSingleton {
	constructor() {
		if (!StateSingleton.instance) {
			let storedData = JSON.parse(localStorage.getItem("state")) || {};
			
			// Add PWA-specific initial state
			storedData.pwaInstallPrompt = null;
			storedData.showInstallButton = false;
			
			this.data = reactive(storedData, this.updateLocalStorage.bind(this));
			bindInputs(this.data);
			this.subscribers = {};
			StateSingleton.instance = this;

			// Initialize route state - include both pathname and hash
			this.data.route = window.location.pathname + window.location.hash;

					// Initialize PWA functionality
		this.initPWA();
		
		// Track user interactions for PWA engagement
		this.trackUserEngagement();

			requestAnimationFrame(() => {
				Object.keys(this.data).forEach((key) => updateDOM(key, this.data[key]));
				updateVisibility();
				updateClasses();
			});
		}
		return StateSingleton.instance;
	}

  /**
     * Updates localStorage when state changes.
     * @param {string} key - The state key that changed.
     * @param {*} value - The new value of the state key.
     */
	updateLocalStorage(key, value) {
		localStorage.setItem("state", JSON.stringify(this.data));
		updateDOM(key, value);
		updateVisibility();
		updateClasses();
	}

	set(properties) {
		Object.entries(properties).forEach(([key, value]) => {
			this.data[key] = value;

			if (this.subscribers[key]) {
				this.subscribers[key].forEach(callback => callback(value));
			}
		});

		requestAnimationFrame(updateVisibility);
		requestAnimationFrame(updateClasses);
	}

	get(key) {
		return this.data[key];
	}

	getData() {
		return this.data;
	}

	
	subscribe(key, callback) {
		if (!this.subscribers[key]) {
			this.subscribers[key] = [];
		}
		this.subscribers[key].push(callback);
		callback(this.data[key]);

		return () => {
			this.subscribers[key] = this.subscribers[key].filter(cb => cb !== callback);
		};
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

			// Handle `show-if`
			if (showIf && typeof this.data[showIf] === "function") {
				el.style.display = this.data[showIf]() ? "" : "none";
			}

			// Handle `class-if`
			if (classIf && typeof this.data[classIf] === "function") {
				el.className = this.data[classIf]() || "";
			}
		});
	}

	// Add PWA initialization method
	initPWA() {
		// Check if already running as installed PWA
		if (window.matchMedia('(display-mode: standalone)').matches || 
			window.navigator.standalone === true) {
			this.data.showInstallButton = false;
			return; // Exit early if already installed
		}
		
		// Register service worker first
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/sw.js')
				.then((registration) => {
					// Check PWA status after service worker is ready
					this.checkPWAStatus();
				})
				.catch((error) => {
					console.error('Service Worker registration failed:', error);
				});
		} else {
			this.checkPWAStatus();
		}
		
		// Listen for beforeinstallprompt event - set up immediately
		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			this.data.pwaInstallPrompt = e;
			this.data.showInstallButton = true;
			
			// Also store globally as backup
			window.deferredPrompt = e;
		});

		// Listen for appinstalled event
		window.addEventListener('appinstalled', () => {
			this.data.pwaInstallPrompt = null;
			this.data.showInstallButton = false;
		});

		// Also check for the event that might have fired before we were ready
		this.checkForExistingPrompt();
	}

	// Check if we missed the beforeinstallprompt event
	checkForExistingPrompt() {
		// Some browsers fire this event before our listener is ready
		// We can check if the event is available in the global scope
		if (window.deferredPrompt) {
			this.data.pwaInstallPrompt = window.deferredPrompt;
			this.data.showInstallButton = true;
		}
	}

	// Check PWA status and requirements
	checkPWAStatus() {
		// Silent status check - no logging needed
		const status = {
			beforeinstallprompt: 'beforeinstallprompt' in window,
			serviceWorker: 'serviceWorker' in navigator,
			manifest: !!document.querySelector('link[rel="manifest"]'),
			displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
			userAgent: navigator.userAgent,
			isHTTPS: location.protocol === 'https:',
			hasEngagement: this.checkUserEngagement()
		};
	}

	// Check if user has sufficient engagement
	checkUserEngagement() {
		// Simple engagement check - you can enhance this
		const hasInteracted = this.data.userInteractions || 0;
		return hasInteracted > 0;
	}

	// Track user interactions for PWA engagement
	trackUserEngagement() {
		let interactionCount = 0;
		
		// Track clicks, scrolls, and other interactions
		const trackInteraction = () => {
			interactionCount++;
			this.data.userInteractions = interactionCount;
			
			// Check if we should show install button after sufficient engagement
			if (interactionCount >= 2 && !this.data.pwaInstallPrompt && window.deferredPrompt) {
				this.checkForExistingPrompt();
			}
		};
		
		// Listen for various user interactions
		document.addEventListener('click', trackInteraction, { once: false });
		document.addEventListener('scroll', trackInteraction, { once: false });
		document.addEventListener('keydown', trackInteraction, { once: false });
	}

	// Add method to trigger install prompt
	async triggerInstall() {
		if (this.data.pwaInstallPrompt) {
			try {
				// Ensure the prompt is shown
				this.data.pwaInstallPrompt.prompt();
				const { outcome } = await this.data.pwaInstallPrompt.userChoice;
				
				// Clear the prompt after use
				this.data.pwaInstallPrompt = null;
				this.data.showInstallButton = false;
				
				if (outcome === 'accepted') {
					// Installation was accepted
					console.log('PWA installation accepted');
				} else {
					// Installation was dismissed
					console.log('PWA installation dismissed');
				}
			} catch (error) {
				console.error('Error during installation:', error);
				// Clear the prompt on error
				this.data.pwaInstallPrompt = null;
				this.data.showInstallButton = false;
			}
		} else {
			// Try to recover from global deferredPrompt
			if (window.deferredPrompt) {
				this.data.pwaInstallPrompt = window.deferredPrompt;
				this.data.showInstallButton = true;
				// Try again
				this.triggerInstall();
			} else {
				console.warn('No install prompt available');
			}
		}
	}

	// Manual method to check and update PWA state
	checkAndUpdatePWAState() {
		// Check if we have a global deferredPrompt
		if (window.deferredPrompt && !this.data.pwaInstallPrompt) {
			this.data.pwaInstallPrompt = window.deferredPrompt;
			this.data.showInstallButton = true;
			return true;
		}
		
		// Check if we're already installed
		if (window.matchMedia('(display-mode: standalone)').matches || 
			window.navigator.standalone === true) {
			this.data.showInstallButton = false;
			return false;
		}
		
		return false;
	}
}

//------------------------------------------------ END STATE

const State = new StateSingleton();
window.State = State;

// Add PWA methods directly to State object for easy access
State.triggerInstall = State.triggerInstall.bind(State);
State.checkAndUpdatePWAState = State.checkAndUpdatePWAState.bind(State);



window.State = State;
window.Fragment = Symbol("Fragment");

/**
 * Creates an internal navigation link that automatically uses the SPA router.
 * @param {string} href - The internal route path
 * @param {Object} props - Additional props for the anchor element
 * @param {...any} children - The link content
 * @returns {HTMLAnchorElement} - An anchor element with internal navigation
 */
window.Link = (props, ...children) => {
  const { href, ...otherProps } = props;
  if (!href || !href.startsWith("/")) {
    console.warn("Link component expects an internal route path starting with '/'");
  }
  return h("a", { href, ...otherProps }, ...children);
};

//------------------------------------------------ END USE STATE

function updateVisibility() {
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

	requestAnimationFrame(trackOnShowElements)
}

/**
 * Evaluates complex conditional expressions for `show-if` and `class-if` attributes.
 * @param {string} condition - The conditional expression to evaluate.
 * @returns {boolean} - Whether the condition evaluates to true or false.
 */
function evaluateCondition(condition) {
	return condition.split(/\s*\|\|\s*/).some(orPart =>
		orPart.split(/\s*&&\s*/).every(andPart =>
			evaluateSingleCondition(andPart.trim())
		)
	);
}

/**
 * Evaluates a single condition expression.
 * @param {string} condition - The condition to evaluate.
 * @returns {boolean} - The result of the condition.
 */
function evaluateSingleCondition(condition) {
	let match = false;
	let stateKey, operator, expectedValue;

	if (condition.startsWith("!")) {
		return !State.get(condition.substring(1).trim());
	}

	if (condition.startsWith("route~=")) {
		return State.get("route").startsWith(condition.replace("route~=", "").trim());
	}
	if (condition.startsWith("route==")) {
		const expectedRoute = condition.replace("route==", "").trim();
		const currentRoute = State.get("route");
		// Match exact route or route with any hash
		return currentRoute === expectedRoute || currentRoute.startsWith(expectedRoute + "#");
	}
	if (condition.startsWith("route!=")) {
		const expectedRoute = condition.replace("route!=", "").trim();
		const currentRoute = State.get("route");
		// Not match if exact route or route with any hash
		return currentRoute !== expectedRoute && !currentRoute.startsWith(expectedRoute + "#");
	}
	if (condition.startsWith("route#=")) {
		const expectedRoute = condition.replace("route#=", "").trim();
		const currentRoute = State.get("route");
		// Match route that has a hash fragment
		return currentRoute.includes("#") && currentRoute.startsWith(expectedRoute + "#");
	}

	if (!/[=<>!~]|matches/.test(condition)) {
		return !!State.get(condition);
	}

	[stateKey, operator, expectedValue] = parseCondition(condition);
	const stateValue = State.get(stateKey.trim());

	if (operator === "matches") {
		try {
			const regexPattern = expectedValue.trim().replace(/^\/|\/$/g, "");
			const regex = new RegExp(regexPattern);
			match = regex.test(stateValue);
		} catch (e) {
			console.error("Invalid regex in class-if condition:", expectedValue, e);
		}
	} else {
		switch (operator) {
			case "==":
				match = stateValue == expectedValue.trim();
				break;
			case "!=":
				match = stateValue != expectedValue.trim();
				break;
			case "~=":
				match = typeof stateValue === "string" && stateValue.includes(expectedValue.trim());
				break;
			case ">":
				match = parseFloat(stateValue) > parseFloat(expectedValue);
				break;
			case "<":
				match = parseFloat(stateValue) < parseFloat(expectedValue);
				break;
			case ">=":
				match = parseFloat(stateValue) >= parseFloat(expectedValue);
				break;
			case "<=":
				match = parseFloat(stateValue) <= parseFloat(expectedValue);
				break;
		}
	}
	return match;
}

function parseCondition(condition) {
	const match = condition.match(/([a-zA-Z0-9_]+)\s*(==|!=|~=|>=|<=|>|<|matches)\s*(\/.*\/|.+)/);
	return match ? [match[1], match[2], match[3]] : [condition, '', ''];
}

/**
 * Creates and returns a DOM element or component using JSX-like syntax.
 * @param {string|Function} tag - The tag name or component function.
 * @param {Object} props - The properties to set on the element.
 * @param {...any} children - The child elements or components.
 * @returns {Node} - The generated DOM node.
 */
window.h = (tag, props = {}, ...children) => {

	if (typeof tag === "function") {
    const node = tag({
      ...props,
      children,
      route: State.get("route")
    });

    // If a component returns a DOM node, mirror native-tag prop behavior on it
    if (node instanceof Node && props) {
      Object.entries(props || {}).forEach(([key, val]) => {
        if (key.startsWith("on") && typeof val === "function") {
          if (key === "onShow") {
            const observer = new IntersectionObserver((entries) => {
              entries.forEach(entry => {
                if (entry.isIntersecting) {
                  val(node);
                }
              });
            }, { threshold: 0.1 });

            requestAnimationFrame(() => {
              if (document.contains(node)) {
                observer.observe(node);
              }
            });

            node.onShow = val;
          } else {
            node.addEventListener(key.slice(2).toLowerCase(), val);
          }
        } else if (key === "class-if" && typeof val === "function") {
          const updateVisibility = () => {
            node.style.display = val() ? "" : "none";
          };

          updateVisibility();

          const boundKey = val.toString().match(/State\.get\(["'](.+?)["']\)/);
          if (boundKey && boundKey[1]) {
            State.subscribe(boundKey[1], updateVisibility);
          }

          const updateClass = () => {
            const className = val();
            node.className = className || "";
          };
          updateClass();
          State.set({ [`__update_${node.tagName?.toLowerCase() || "component"}`]: updateClass });
          window.addEventListener("popstate", updateClass);
        } else if (key === "show-if" && typeof val === "function") {
          const updateVisibility = () => {
            node.style.display = val() ? "" : "none";
          };

          updateVisibility();

          const boundKey = val.toString().match(/State\.get\(["'](.+?)["']\)/);
          if (boundKey && boundKey[1]) {
            State.subscribe(boundKey[1], updateVisibility);
          }
        } else if (key === "valid-if" && typeof val === "function") {
          node.validIf = val;
        } else {
          // For attributes like show-if/class-if that are strings, just set them;
          // global updateVisibility/updateClasses will handle them.
          node.setAttribute?.(key, val);
        }
      });

      // Handle internal route navigation for components that return anchor elements
      if (node.tagName === "A") {
        const href = node.getAttribute("href");
        if (href && href.startsWith("/") && !href.startsWith("//")) {
          // Internal route - intercept navigation
          node.addEventListener("click", (e) => {
            // Only intercept if no onClick handler or onClick didn't prevent default
            if (!props.onClick || props.onClick(e) !== false) {
              // Don't intercept if there's a hash fragment - let browser handle it naturally
              if (href.includes("#")) {
                // Let the browser handle hash navigation naturally
                return;
              }
              e.preventDefault();
              navigate(href);
            }
          });
        }
      }

      // Align with native input/textarea/select handling for data-bind invalid state clearing
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

      // Preserve props for route onEnter/onLeave parity
      node.props = { ...(node.props || {}), ...props };
    }

    return node;
	}

	if (typeof tag === "symbol" && tag.toString() === "Symbol(Fragment)") {
		const fragment = document.createDocumentFragment();
		children.flat().forEach(child => fragment.append(child));
		return fragment;
	}

	if (typeof tag !== "string") {
		console.error("Invalid tag passed to h():", tag);
		return document.createComment("Invalid component");
	}

	let el = document.createElement(tag);

	// Add SVG namespace support
	if (tag === 'svg' || ['path', 'circle', 'rect', 'line', 'polygon', 'g', 'defs', 'use', 'text', 'tspan', 'title', 'desc', 'metadata', 'symbol', 'marker', 'pattern', 'filter', 'feGaussianBlur', 'feOffset', 'feMerge', 'feMergeNode', 'feComposite', 'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feFuncR', 'feFuncG', 'feFuncB', 'feFuncA', 'feConvolveMatrix', 'feDiffuseLighting', 'feSpecularLighting', 'fePointLight', 'feSpotLight', 'feDistantLight', 'feMorphology', 'feTile', 'feTurbulence', 'feDisplacementMap', 'feFlood', 'feImage', 'feDropShadow'].includes(tag)) {
		const svgEl = document.createElementNS('http://www.w3.org/2000/svg', tag);
		// Copy all properties and methods from the HTML element to the SVG element
		Object.getOwnPropertyNames(el).forEach(prop => {
			try {
				if (prop !== 'namespaceURI') {
					svgEl[prop] = el[prop];
				}
			} catch (e) {
				// Skip read-only properties
			}
		});
		el = svgEl;
	}

	Object.entries(props || {}).forEach(([key, val]) => {
		if (key.startsWith("on") && typeof val === "function") {
			if (key === "onShow") {
				const observer = new IntersectionObserver((entries) => {
					entries.forEach(entry => {
						if (entry.isIntersecting) {
							val(el);
						}
					});
				}, {
					threshold: 0.1
				});

				requestAnimationFrame(() => {
					if (document.contains(el)) {
						observer.observe(el);
					}
				});

				el.onShow = val;
			} else if (key === "onClick" && el.tagName === "A") {
				// Handle link clicks - allow href navigation by default, but support onClick
				el.addEventListener("click", (e) => {
					// If onClick returns false, prevent default navigation
					if (val(e) === false) {
						e.preventDefault();
					}
				});
			} else {
				el.addEventListener(key.slice(2).toLowerCase(), val);
			}
		} else if (key === "class-if" && typeof val === "function") {
			const updateVisibility = () => {
				el.style.display = val() ? "" : "none";
			};

			updateVisibility();

			const boundKey = val.toString().match(/State\.get\(["'](.+?)["']\)/);
			if (boundKey && boundKey[1]) {
				State.subscribe(boundKey[1], updateVisibility);
			}

			const updateClass = () => {
				const className = val();
				el.className = className || "";
			};
			updateClass();
			State.set({
				[`__update_${tag}`]: updateClass
			});
			window.addEventListener("popstate", updateClass);
		} else if (key === "show-if" && typeof val === "function") {
			if (typeof val === "function") {
				//
				const updateVisibility = () => {
					el.style.display = val() ? "" : "none";
				}

				updateVisibility()

				//
				const boundKey = val.toString().match(/State\.get\(["'](.+?)["']\)/);
				if (boundKey && boundKey[1]) {
					State.subscribe(boundKey[1], updateVisibility);
				}
			}
		} else if (key === "valid-if" && typeof val === "function") {
			el.validIf = val;
		} else {
			el.setAttribute(key, val);
		}
	});


	// Handle internal route navigation for links
	if (el.tagName === "A") {
		const href = el.getAttribute("href");
		if (href && href.startsWith("/") && !href.startsWith("//")) {
			// Internal route - intercept navigation
			el.addEventListener("click", (e) => {
				// Only intercept if no onClick handler or onClick didn't prevent default
				if (!props.onClick || props.onClick(e) !== false) {
					// Don't intercept if there's a hash fragment - let browser handle it naturally
					if (href.includes("#")) {
						// Let the browser handle hash navigation naturally
						return;
					}
					e.preventDefault();
					navigate(href);
				}
			});
		}
	}

	if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
		const bindKey = props["data-bind"];
		if (bindKey) {
			const clearInvalidState = () => {
				if (State.get(`${bindKey}_invalid`)) {
					State.set({
						[`${bindKey}_invalid`]: undefined
					});
					State.set({
						[`${bindKey}_valid`]: true
					});
					el.classList.remove('invalid');
				}
			};
			el.addEventListener("input", clearInvalidState);
			el.addEventListener("change", clearInvalidState);
			el.addEventListener("focus", clearInvalidState);
		}
	}

	children.flat().forEach((child) => {
		if (typeof child === "function") {
			const placeholder = document.createTextNode("");
			el.appendChild(placeholder);

			const render = () => {
				const result = child();

				// Clear any existing content after the placeholder
				while (placeholder.nextSibling && placeholder.nextSibling.nodeType !== 8) {
					placeholder.nextSibling.remove();
				}

				if (Array.isArray(result)) {
					while (placeholder.nextSibling && placeholder.nextSibling.nodeType !== 8) {
						placeholder.nextSibling.remove();
					}

					const fragment = document.createDocumentFragment();
					result.forEach(item => {
						if (item instanceof Node) {
							fragment.appendChild(item);
						} else {
							fragment.appendChild(document.createTextNode(String(item)));
						}
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
				} else if (result === null || result === undefined) {
					// Handle null/undefined results
					placeholder.after(document.createComment("No content"));
				} else {
					// Fallback for other types
					placeholder.after(document.createTextNode(String(result)));
				}
			};

			// Track which state keys this function accesses
			const accessedKeys = new Set();
			
			// Execute the function to capture accessed keys
			try {
				// Create a proxy to intercept State.get calls
				const originalGet = State.get;
				State.get = function(key) {
					accessedKeys.add(key);
					return originalGet.call(State, key);
				};
				
				child();
				
				// Restore original State.get
				State.get = originalGet;
			} catch (e) {
				console.error('Error executing function child:', e);
			}
			
			// Subscribe to all accessed keys
			accessedKeys.forEach(key => {
				State.subscribe(key, render);
			});

			render();
		} else if (Array.isArray(child)) {
			child.forEach(item => {
				if (item instanceof Node) {
					el.appendChild(item);
				} else {
					el.appendChild(document.createTextNode(String(item)));
				}
			});
		}	else if (typeof child === "string" || typeof child === "number") {
			el.appendChild(document.createTextNode(child));
		} else if (child instanceof Node) {
			el.appendChild(child);
		}
	});

	return el;
};




window.routes = {
	'/404': () => h("div", {}, "404 Page not found")
};

/**
 * Navigates to a new route and updates the view accordingly.
 * @param {string} path - The target route path.
 * @param {Object|boolean} options - Either a state object to set, or a boolean for replace behavior.
 * @param {boolean} replace - Whether to replace the current history state (only used when second param is state object).
 */
window.navigate = (path, options = false, replace = false) => {
	// Extract pathname and hash from the path
	const [pathname, hash] = path.split('#');
	const fullPath = hash ? `${pathname}#${hash}` : pathname;
	
	if (fullPath === State.get('route')) return;

	// Handle different parameter patterns
	let stateToSet = {};
	let shouldReplace = false;
	
	if (typeof options === 'object' && options !== null) {
		// Second param is state object: navigate("/route", {navOpen: false})
		stateToSet = options;
		shouldReplace = replace;
	} else if (typeof options === 'boolean') {
		// Second param is replace boolean: navigate("/route", true)
		shouldReplace = options;
	}

	// Update state (this triggers the show-if system to update views)
	State.set({
		route: fullPath,
		...stateToSet
	});



	// Scroll to top of page (unless navigating to a hash)
	if (!hash) {
		window.scrollTo(0, 0);
	}

	// Update browser history
	if (shouldReplace) {
		history.replaceState({
			path: fullPath
		}, "", fullPath);
	} else {
		history.pushState({
			path: fullPath
		}, "", fullPath);
	}
};

window.addEventListener("popstate", (event) => {
	navigate(event.state?.path || "/", true);
});

// Listen for hash changes to update route state
window.addEventListener("hashchange", () => {
	const currentRoute = State.get('route');
	const newRoute = window.location.pathname + window.location.hash;
	if (currentRoute !== newRoute) {
		State.set({ route: newRoute });
	}
});

document.addEventListener("DOMContentLoaded", () => {
	navigate(State.get('route') || '/', true);
});

/**
 * Validates all fields within a specified validation group.
 *
 * This function iterates over all form fields within the given `groupName`,
 * checking their `valid-if` attributes (if present). If a field fails validation,
 * an error class is applied, and the function returns `false`. If all fields pass,
 * it returns `true`.
 *
 * @param {string} groupName - The validation group name.
 * @returns {boolean} - `true` if all fields pass validation, otherwise `false`.
 *
 * @example
 * // HTML:
 * <form group-name="signup">
 *     <input type="text" data-bind="email" valid-if="() => State.get('email').includes('@')">
 *     <input type="password" data-bind="password">
 * </form>
 * <button onClick="validate('signup')">Submit</button>
 *
 * // JavaScript:
 * if (validate("signup")) {
 *     console.log("Form is valid!");
 * } else {
 *     console.log("Validation failed.");
 * }
 */
window.validate = function(groupName) {
	const wrapper = document.querySelector(`[group="${groupName}"]`);
	const wrapperFields = wrapper ? [...wrapper.querySelectorAll("input, select, textarea")] : [];
	const directFields = [...document.querySelectorAll(`[group="${groupName}"]:is(input, select, textarea)`)];
	const extraFieldsInsideGroups = [...document.querySelectorAll(`[group="${groupName}"] input, select, textarea`)];
	const fields = [...new Set([...wrapperFields, ...directFields, ...extraFieldsInsideGroups])].filter(
		field => typeof field.validIf === "function"
	);

	let allValid = true;
	let validationStates = {};

	fields.forEach((field) => {
		let validationFn = field.validIf;
		let bindKey = field.getAttribute("data-bind");

		if (typeof validationFn === "function" && bindKey) {
			try {
				const isValid = validationFn();

				field.classList.toggle("valid", isValid);
				field.classList.toggle("invalid", !isValid);

				validationStates[`${bindKey}_valid`] = isValid;
				validationStates[`${bindKey}_invalid`] = !isValid;

				if (!isValid) allValid = false;
			} catch (e) {
				console.error("Error executing valid-if function:", validationFn, e);
				allValid = false;
			}
		}
	});

	State.set(validationStates);
	State.set({
		[`${groupName}_valid`]: allValid,
		[`${groupName}_invalid`]: !allValid
	});

	return allValid;
}

/**
 * Resets validation errors within a specified validation group.
 *
 * This function removes any error indicators from fields within the
 * given `groupName`, effectively resetting their validation state.
 *
 * @param {string} groupName - The validation group name.
 *
 * @example
 * resetValidation("signup");
 */
window.resetValidation = function(groupName) {
	const wrapper = document.querySelector(`[group="${groupName}"]`);
	const wrapperFields = wrapper ? [...wrapper.querySelectorAll("input, select, textarea")] : [];
	const directFields = [...document.querySelectorAll(`[group="${groupName}"]:is(input, select, textarea)`)];
	const extraFieldsInsideGroups = [...document.querySelectorAll(`[group="${groupName}"] input, select, textarea`)];
	const fields = [...new Set([...wrapperFields, ...directFields, ...extraFieldsInsideGroups])];

	let validationStates = {};

	fields.forEach((field) => {
		let bindKey = field.getAttribute("data-bind");

		if (bindKey) {
			validationStates[`${bindKey}_valid`] = undefined;
			validationStates[`${bindKey}_invalid`] = undefined;

			field.classList.remove("valid", "invalid");
		}
	});

	State.set(validationStates);

	State.set({
		[`${groupName}_valid`]: undefined,
		[`${groupName}_invalid`]: undefined
	});
}

/**
 * Creates a reactive object that triggers updates when properties change.
 * @param {Object} obj - The initial state object.
 * @param {Function} callback - Function to call on state updates.
 * @returns {Proxy} - A proxy object with reactive behavior.
 */
window.reactive = function(obj, callback) {
	return new Proxy(obj, {
		set(target, key, value) {
			if (target[key] === value) return true;
			target[key] = value;
			callback(key, value);
			return true;
		}
	});
}

/**
 * Updates DOM elements bound to a specific state key by setting their text content.
 * Also ensures `data-bind` elements remain in sync with state changes.
 * @param {string} key - The state key.
 * @param {*} value - The new value.
 */
window.updateDOM = function(key, value) {
	const elements = document.querySelectorAll(`[data-bind="${key}"]`);
	elements.forEach(element => {
		if (
			element.tagName === 'INPUT' ||
			element.tagName === 'TEXTAREA' ||
			element.tagName === 'SELECT'
		) {
			if (element.type === 'checkbox') {
				element.checked = Boolean(value);
			} else if (element.type === 'radio') {
				element.checked = (element.value === value);
			} else {
				element.value = value || '';
			}
		} else {
			element.textContent = value;
		}
	});

	requestAnimationFrame(updateVisibility);
	requestAnimationFrame(updateClasses);
}

/**
 * Updates elements with `class-if` attributes based on conditions.
 * Dynamically toggles CSS classes based on state values.
 * @example <div class-if="isActive ? 'active' : 'inactive'"></div>
 */
function updateClasses() {
	document.querySelectorAll("[class-if]").forEach((element) => {
		const classRules = element.getAttribute("class-if").split(";").map(rule => rule.trim());

		classRules.forEach(rule => {
			let match;
			if (rule.includes("?")) {
				const [condition, classes] = rule.split("?").map(s => s.trim());
				const [trueClass, falseClass] = classes.split(":").map(s => s.trim());
				match = evaluateCondition(condition);
				element.classList.toggle(trueClass, match);
				if (falseClass) {
					element.classList.toggle(falseClass, !match);
				}
			} else if (rule.includes(":")) {
				const [stateKey, className] = rule.split(":").map(s => s.trim());
				match = State.get(stateKey);
				element.classList.toggle(className, !!match);
			}
		});
	});
}

/**
 * Binds input elements with `data-bind` attributes to state.
 * Ensures two-way data binding between form elements and state.
 * Works with input, textarea, and select elements.
 * @example <input type="text" data-bind="username">
 */
function bindInputs(data) {
	document.addEventListener("change", (event) => {
		const target = event.target;
		const key = target.getAttribute("data-bind");

		if (key) {
			if (target.type === "checkbox") {
				data[key] = target.checked;
				updateDOM(key, target.checked);
			} else {
				data[key] = target.value;
				updateDOM(key, target.value);
			}
			updateVisibility();
			updateClasses();
		}
	});
}

/**
 * Tracks elements with `on-show` attributes and executes callbacks when they appear in the viewport.
 * Useful for lazy-loading elements or triggering animations when elements become visible.
 * @example <div on-show="() => console.log('Element is now visible')"></div>
 */
function trackOnShowElements() {
	const elements = document.querySelectorAll("[onShow]");

	elements.forEach((element) => {
		if (!element.__onShowObserver) {
			const observer = new IntersectionObserver((entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						const onShowFn = element.getAttribute("onShow");
						if (onShowFn) {
							try {
								element.onShow();
							} catch (e) {
								console.error("Error executing onShow function:", e);
							}
						}
					}
				});
			});

			observer.observe(element);
			element.__onShowObserver = observer;
		}
	});
}

  // Make State available globally for convenience
  window.State = window.State || State;
  
  // Add JSX transformation support
  window.Pragmatic.h = window.h;
  window.Pragmatic.Fragment = window.Fragment;
  window.Pragmatic.State = window.State;
  window.Pragmatic.navigate = window.navigate;
  window.Pragmatic.routes = window.routes;
  window.Pragmatic.validate = window.validate;
  window.Pragmatic.resetValidation = window.resetValidation;
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      // Trigger initial route
      if (window.navigate) {
        window.navigate(window.location.pathname + window.location.hash, true);
      }
    });
  } else {
    // DOM already loaded
    if (window.navigate) {
      window.navigate(window.location.pathname + window.location.hash, true);
    }
  }

  console.log('Pragmatic.js loaded successfully with JSX support');
})();
