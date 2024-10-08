export class RoutingService {
    constructor() {}
    async navigateToLocation(locationArray = [], appName) {
        const ACHILLESIDE_PAGE = "achilleside-page";

       if (locationArray.length === 0 || locationArray[0] === ACHILLESIDE_PAGE) {
            const pageUrl = `${assistOS.space.id}/${appName}/${ACHILLESIDE_PAGE}`;
            await assistOS.UI.changeToDynamicPage(ACHILLESIDE_PAGE, pageUrl);
            return;
        }
         if(locationArray[locationArray.length-1]!== ACHILLESIDE_PAGE){
         console.error(`Invalid URL: URL must end with ${ACHILLESIDE_PAGE}`);
            return;
        }
        const webComponentName = locationArray[locationArray.length - 1];
        const pageUrl = `${assistOS.space.id}/${appName}/${locationArray.join("/")}`;
        await assistOS.UI.changeToDynamicPage(webComponentName, pageUrl);
    }
}
