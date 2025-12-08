chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "findGerritLinks") {
        findAndLogGerritLinks(sendResponse);
        return true;
    }
    return false;
})

function findAndLogGerritLinks(sendResponseCallback) {

    let responseData = {
        status: "error",
        message: "Elements not found or an error occurred.",
        linkLeft: null,
        linkRight: null
    }
    try {
        let currentElement = document.querySelector("#pg-app");
        if (!currentElement) {
            console.error("Motion: Element #pg-app not found. Aborting.");
            responseData.message = "pg-app not found";
            sendResponseCallback(responseData);
            return;
        }

        if (!currentElement.shadowRoot) {
            console.error("Motion: #pg-app has no shadowRoot. Aborting.");
            responseData.message = "pg-app has no shadow root";
            sendResponseCallback(responseData);
            return;
        }
        currentElement = currentElement.shadowRoot.querySelector("#app-element");
        if (!currentElement) {
            console.log("Motion: Element #app-element within #pg-app's shadowRoot not found. Aborting.");
            responseData.message = "app-element not found";
            sendResponseCallback(responseData);
            return;
        }
        if (!currentElement.shadowRoot) {
            console.log("Motion: #app-element has no shadowRoot. Aborting.");
            responseData.message = "app-element has no shadow root";
            sendResponseCallback(responseData);
            return;
        }
        currentElement = currentElement.shadowRoot.querySelector("main > gr-diff-view");
        if (!currentElement) {
            console.log("Motion: Element 'main > gr-diff-view' within #app-element's shadowRoot not found. Aborting.");
            responseData.message = "gr-diff-view not found";
            sendResponseCallback(responseData);
            return;
        }
        if (!currentElement.shadowRoot) {
            console.log("Motion: 'main > gr-diff-view' has no shadowRoot. Aborting.");
            responseData.message = "gr-diff-view has no shadow root";
            sendResponseCallback(responseData);
            return;
        }
        const grDropdownElement = currentElement.shadowRoot.querySelector("div.stickyHeader > div.subHeader > div.patchRangeLeft > span > gr-dropdown");
        if (!grDropdownElement) {
            console.log("Motion: Element 'gr-dropdown' not found within 'gr-diff-view's shadowRoot. Aborting.");
            responseData.message = "gr-dropdown not found";
            sendResponseCallback(responseData);
            return;
        }

        if (!grDropdownElement.shadowRoot) {
            console.log("Motion: 'gr-dropdown' has no shadowRoot. Aborting.");
            responseData.message = "gr-dropdown has no shadow root";
            sendResponseCallback(responseData);
            return;
        }
        const dropdownShadowRoot = grDropdownElement.shadowRoot;

        const dropdownContent = dropdownShadowRoot.querySelector(".dropdown-content");

        if (!dropdownContent) {
            console.log("Motion: Element 'div.dropdown-content' not found. Aborting.");
            responseData.message = "div.dropdown-content not found";
            sendResponseCallback(responseData);
            return;
        }

        const allLinkItems = dropdownContent.querySelectorAll("gr-tooltip-content");
        allLinkItems.forEach(item => {
            const linkElement = item.querySelector("a.itemAction");
            if (linkElement && linkElement.href) {
                const menuItem = linkElement.querySelector("md-menu-item");
                if (menuItem) {
                    const text = menuItem.textContent || '';
                    if (text.includes('Left Content')) {
                        responseData.linkLeft = linkElement.href;
                        console.log("Motion: Left link found ", linkElement.href);
                    }

                    if (text.includes('Right Content')) {
                        responseData.linkRight = linkElement.href;
                        console.log("Motion: Right link found ", linkElement.href);
                    }
                }
            }
        })

        if(responseData.linkLeft || responseData.linkRight){
            console.log("Motion: Links Found")
            responseData.status = "success";
            responseData.message = "Links found";
        } else {
            console.log("Motion: No links found")
            responseData.message = "No relevant links found";
        }
    } catch (error) {
        console.error("Motion: An error occurred during the DOM traversal:", error);
        if (responseData.status === "error" && responseData.message === "Elements not found or an error occurred.") {
            responseData.message = error.message || "An unexpected error occurred.";
        }
    }
    sendResponseCallback(responseData);
}
