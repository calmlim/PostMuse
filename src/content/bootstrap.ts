import { XPostObserver } from "./observer";
import { mountInlinePost } from "./x-adapter/inject-trigger";

const observer = new XPostObserver(mountInlinePost);
observer.start();
