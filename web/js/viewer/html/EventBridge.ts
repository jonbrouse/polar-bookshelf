import {Logger} from '../../logger/Logger';
import {FrameEvents} from './FrameEvents';
import {Events} from '../../util/dom/Events';

const log = Logger.create();

/**
 * Moves events from the iframe, into the target element. This allows the event
 * listeners to see the event as if it was called inside the parent .page in the
 * parent DOM window.
 */
export class EventBridge {

    private readonly targetElement: HTMLElement;

    private readonly iframe: HTMLIFrameElement;

    constructor(targetElement: HTMLElement, iframe: HTMLIFrameElement) {
        this.targetElement = targetElement;
        this.iframe = iframe;
    }

    start() {

        if(! this.iframe.parentElement) {
            throw new Error("No parent for iframe");
        }

        if(! this.iframe.contentDocument) {
            throw new Error("No contentDocument for iframe");
        }

        // TODO/FIXME: the child iframes within this iframe / recursively also
        // need to be configured.

        this.iframe.addEventListener("load", () => this.addListeners(this.iframe));

        this.iframe.parentElement.addEventListener('DOMNodeInserted', (event) => this.elementInsertedListener(event), false);

        //this.addListeners(this.iframe);

        log.info("Event bridge started on: ", this.iframe.contentDocument.location.href);

    }

    elementInsertedListener(event: any) {

        log.info("elementInsertedListener event: " , event)

        if (event && event.target && event.target.tagName === "IFRAME") {
            log.info("Main iframe re-added.  Registering event listeners again");
            let iframe = event.target;
            this.addListeners(iframe);
        }

    }

    addListeners(iframe: HTMLIFrameElement) {

        if(! iframe.contentDocument) {
            return;
        }

        iframe.contentDocument.body.addEventListener("keyup", this.keyListener.bind(this));
        iframe.contentDocument.body.addEventListener("keydown", this.keyListener.bind(this));

        iframe.contentDocument.body.addEventListener("mouseup", this.mouseListener.bind(this));
        iframe.contentDocument.body.addEventListener("mousedown", this.mouseListener.bind(this));
        iframe.contentDocument.body.addEventListener("contextmenu", this.mouseListener.bind(this));

        iframe.contentDocument.body.addEventListener("click", event => {

            let anchor = Events.getAnchor(event.target);

            // TODO: this needs to be reworked. This isn't the appropriate way
            // to handle this.  I'm going to have to think about which "actions"
            // must be handled by Polar and which ones we allow to be handled
            // by the PHZ.  All Polar actions should call preventDefault and
            // should preventDefault and not sent to the PHZ.

            if(anchor) {
                log.info("Link click prevented.");
                event.preventDefault();

                let href = anchor.href;

                if(href && (href.startsWith("http:") || href.startsWith("https:"))) {
                    // this is a bit of a hack but basically we listen for URLs
                    // in the iframe and change the main page. This triggers our
                    // electron 'will-navigate' which which prevents it and then
                    // opens the URL in the native browser.
                    document.location.href = href;
                }

            } else {
                this.mouseListener(event);
            }

        });

    }



    mouseListener(event: any) {

        let eventPoints = FrameEvents.calculatePoints(this.iframe, event);

        let newEvent = new event.constructor(event.type, event);

        // TODO: the issue now , I think, is that these values need to be updated
        // vs the current scroll.x and scroll.y

        Object.defineProperty(newEvent, "pageX", {value: eventPoints.page.x});
        Object.defineProperty(newEvent, "pageY", {value: eventPoints.page.y});

        Object.defineProperty(newEvent, "clientX", {value: eventPoints.client.x});
        Object.defineProperty(newEvent, "clientY", {value: eventPoints.client.y});

        Object.defineProperty(newEvent, "offsetX", {value: eventPoints.offset.x});
        Object.defineProperty(newEvent, "offsetY", {value: eventPoints.offset.y});

        if(newEvent.pageX !== eventPoints.page.x) {
            throw new Error("Define of properties failed");
        }

        this.targetElement.dispatchEvent(newEvent);

    }

    keyListener(event: any) {

        let newEvent = new event.constructor(event.type, event);

        this.targetElement.dispatchEvent(newEvent);

    }

}
