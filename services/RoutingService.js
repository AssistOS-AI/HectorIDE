export class RoutingService {
    constructor() {}
    async navigateToLocation(locationArray = [], appName) {
        const HECTORIDE_PAGE = "hectoride-page";

       if (locationArray.length === 0 || locationArray[0] === HECTORIDE_PAGE) {
            const pageUrl = `${assistOS.space.id}/${appName}/${HECTORIDE_PAGE}`;
            await assistOS.UI.changeToDynamicPage(HECTORIDE_PAGE, pageUrl);
            return;
        }
         if(locationArray[locationArray.length-1]!== HECTORIDE_PAGE){
         console.error(`Invalid URL: URL must end with ${HECTORIDE_PAGE}`);
            return;
        }
        const webComponentName = locationArray[locationArray.length - 1];
        const pageUrl = `${assistOS.space.id}/${appName}/${locationArray.join("/")}`;
        await assistOS.UI.changeToDynamicPage(webComponentName, pageUrl);
    }
}
