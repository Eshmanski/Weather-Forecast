import {Component} from "./Component";
import {RenderOptions} from "../Interfaces";

class WrapperComponent extends Component {
    protected template: string;
    protected rendersOptions: RenderOptions[];


    constructor(template: string, rendersOptions: RenderOptions[]) {
        super();

        this.template = template;
        this.rendersOptions = rendersOptions;
    }

    protected getTemplate(): string {
        return this.template;
    }

    protected getRenderOptions(): RenderOptions[] {
        return this.rendersOptions;
    }
}

export function createWrapper(template: string, rendersOptions: RenderOptions[]): Component {
    return new WrapperComponent(template, rendersOptions);
}