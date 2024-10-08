export class RoutingService {
    constructor() {}
    async navigateToLocation(locationArray = [], appName) {
        const PROOFREADER_PAGE = "proofreader-page";

       if (locationArray.length === 0 || locationArray[0] === PROOFREADER_PAGE) {
            const pageUrl = `${assistOS.space.id}/${appName}/${PROOFREADER_PAGE}`;
            await assistOS.UI.changeToDynamicPage(PROOFREADER_PAGE, pageUrl);
            return;
        }
         if(locationArray[locationArray.length-1]!== PROOFREADER_PAGE){
         console.error(`Invalid URL: URL must end with ${PROOFREADER_PAGE}`);
            return;
        }
        const webComponentName = locationArray[locationArray.length - 1];
        const pageUrl = `${assistOS.space.id}/${appName}/${locationArray.join("/")}`;
        await assistOS.UI.changeToDynamicPage(webComponentName, pageUrl);
    }
}
