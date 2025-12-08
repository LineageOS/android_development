document.addEventListener('DOMContentLoaded', function() {

  const actionBtn = document.getElementById('actionBtn');
  const popupMsg = document.getElementById('popupMsg');

  if (actionBtn) {
    actionBtn.addEventListener('click', function() {
        popupMsg.textContent = "Searching page...";

        chrome.tabs.query({ active: true, currentWindow: true },
            function(tabs) {
                if(tabs.length === 0){
                    popupMsg.textContent = "No active tabs found.";
                    return;
                }

                const activeTab = tabs[0]
                if(!activeTab.id){
                    popupMsg.textContent = "Active tab has no id";
                    return;
                }

                if(!activeTab.url || !activeTab.url.startsWith("https://googleplex-android-review.git.corp.google.com")){
                    popupMsg.textContent = "Can only run on Gerrit Page";
                    return;
                }

                chrome.tabs.sendMessage(
                    activeTab.id,
                    {action: "findGerritLinks"},
                    function(response){
                        if(chrome.runtime.lastError){
                            popupMsg.textContent = "Ensure you are on correct Gerrit Page";
                        } else if(response){
                            if(response.status === "success"){
                                popupMsg.textContent = "Links Found. Redirecting...";
                                redirectToMotionSite(response.linkLeft, response.linkRight);
                            } else {
                                popupMsg.textContent = response.message;
                            }
                        } else {
                            popupMsg.textContent = "No response from page.";
                        }
                    }
                );

            }
        );
    });
  }
});


function redirectToMotionSite(linkLeft, linkRight) {
    const baseUrl = "https://motion.teams.x20web.corp.google.com/";
    const params = new URLSearchParams();
    if (linkLeft) params.append("leftLink", linkLeft);
    if (linkRight) params.append("rightLink", linkRight);
    let finalUrl = baseUrl;
    const paramString = params.toString();
    if (paramString) finalUrl += "?" + paramString;
    chrome.tabs.create({ url: finalUrl });
}