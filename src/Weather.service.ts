import {City, ClientData, DragDropOptions, Weather} from './Interfaces';
import {CardType, ChangePositionType, createElement, SortType, SortTypeMethods, WeatherAction} from "./utils";

export class WeatherService {
    allCities: City[] = [];
    chosenCities: City[] = [];
    clientData: ClientData = { ip: '', city: '', region: '', country: '', loc: '', org: '', postal: '', timezone: '' };
    private dragOption: DragDropOptions = { dragElement: null, cardType: CardType.big };
    private sortType: SortType = SortType.ABC;
    private filterText: string = '';
    private filterWeather: Weather = {
        sunny: false,
        cloudy: false,
        snowy: false,
        rainy: false,
        blizzard: false,
        stormy: false,
        metorite: false
    };
    private emptyCardElement: Element = createElement('<div class="big card-empty _card_empty _card"></div>')

    public async fetchMyPosition(): Promise<ClientData> {
        this.clientData = await fetch('https://ipinfo.io/json?token=be765effc66354')
            .then((res: Response) => res.json())
            .catch((e) => { throw new Error(e) });

        return this.clientData;
    }

    public async fetchAllCity(): Promise<City[]> {
        this.allCities = await fetch('https://geo-weather-json.herokuapp.com/db')
            .then((res: Response) => res.json())
            .then<City[]>(data => data.cities)
            .catch((e) => { throw new Error(e) });


        return this.allCities.sort(SortTypeMethods[this.sortType]);
    }

    public getCityForSmallList(): City[] {
        return this.allCities.filter(
            (cityWeather: City) => {
                if(this.filterText.trim())
                    return cityWeather.city.toLocaleLowerCase().includes(this.filterText);
                else
                    return true;
            }).sort(SortTypeMethods[this.sortType]);
    }

    public getCityForBigList(): City[] {
        return this.chosenCities.filter((cityWeather: City) => {
            return Object.keys(this.filterWeather)
                .reduce<boolean>((accum: boolean, key: keyof Weather): boolean => {
                    if(this.filterWeather[key]) {
                         return cityWeather.weather[key] && accum
                    }

                    return accum;
            }, true)
        });
    }

    public setSortType(sortType: SortType): void {
        this.sortType = sortType;
        this.emitEvent(WeatherAction.SORT_CHANGES, sortType);
    }

    public setFilterText(inputText: string): void {
        if(this.filterText.trim() !== inputText.trim()) {
            this.filterText = inputText.toLocaleLowerCase();
            this.emitEvent(WeatherAction.SEARCH_CHANGES, inputText);
        }
    }

    public toggleFilterWeather(key: keyof Weather): void {
        this.filterWeather[key] = !this.filterWeather[key];
        this.emitEvent(WeatherAction.FILTER_CHANGES, this.filterWeather[key]);
    }

    public onMarkerOver(city: string): void {
        this.emitEvent(WeatherAction.MOUSE_OVER_MARKER, city);
    }

    public onMarkerOut(city: string): void {
        this.emitEvent(WeatherAction.MOUSE_OUT_MARKER, city);
    }

    public mouseOverCard(city: string): void {
        this.emitEvent(WeatherAction.MOUSE_OVER_CARD, city);
    }

    public mouseOutCard(city: string): void {
        this.emitEvent(WeatherAction.MOUSE_OUT_CARD, city);
    }

    public mouseClickCard(city: string): void {
        this.emitEvent(WeatherAction.MOUSE_CLICK_CARD, city);
    }

    public makeCardDraggable(element: Element, cityWeather: City): void {
        element.addEventListener('dragstart', (event: DragEvent) => {
            event.dataTransfer.setData('text', 'anything');
            this.dragOption.dragElement = element as HTMLElement;
            element.classList.add('small-card-shadow');
        });

        element.addEventListener('dragend', () => {
            if(document.contains(this.emptyCardElement)) {
                const prevCardName: string = (this.emptyCardElement.previousElementSibling as HTMLElement)
                    .dataset.name;

                this.changePosition(prevCardName, cityWeather);
            }


            element.classList.remove('small-card-shadow');
            this.dragOption.dragElement = null;
            this.emptyCardElement.remove();
        });
    }

    public makeListDroppable(element: Element): void {
        element.addEventListener('dragover', (event: DragEvent) => {
            event.preventDefault();

            if(!this.dragOption.dragElement)
                    return;

            const underElement = event.target as HTMLElement
            const underCardElement: HTMLElement = underElement.closest('._card');
            const underListElement: HTMLElement = underElement.closest('._list');

            if (underCardElement?.classList?.contains('_card_empty')
                || (underCardElement === this.dragOption.dragElement)) {
                return;
            }

            this.dragOption.cardType = underListElement.dataset.type as CardType;
            this.resizeEmptyElement();

            if(underCardElement) {
                if(underCardElement.previousElementSibling.classList.contains('_card_empty')) {
                    underListElement.insertBefore(this.emptyCardElement, underCardElement.nextElementSibling);
                } else {
                    underListElement.insertBefore(this.emptyCardElement, underCardElement);
                }
            } else {
                underListElement.append(this.emptyCardElement);
            }
        });
        element.addEventListener('drop', (event: Event) => event.preventDefault());
    }

    private changePosition(prevCardName: string, cityWeather: City): void {
        const changePositionType: ChangePositionType = this.createChangePositionType();

        let toStorage: City[];
        let data: { cityWeather: City, changePositionType: ChangePositionType } = {cityWeather, changePositionType};

        if(changePositionType.split('=>')[0] === 'small')
            this.allCities = this.allCities.filter((item: City) => item.city !== cityWeather.city);
         else
            this.chosenCities = this.chosenCities.filter((item: City) => item.city !== cityWeather.city);


        switch(changePositionType) {
            case ChangePositionType.SmallToBig:
                toStorage = this.chosenCities;
                this.pushToStorage(toStorage, prevCardName, cityWeather);
                this.unsetFilterWeather();
                break;
            case ChangePositionType.BigToSmall:
                toStorage = this.allCities;
                this.pushToStorage(toStorage, prevCardName, cityWeather);
                this.unsetSort();
                break;
            case ChangePositionType.BigToBig:
                toStorage = this.chosenCities;
                this.pushToStorage(toStorage, prevCardName, cityWeather);
                break;
            case ChangePositionType.SmallToSmall:
                toStorage = this.allCities;
                this.pushToStorage(toStorage, prevCardName, cityWeather);
                this.unsetSort();
                break;
        }

        this.emitEvent(WeatherAction.CARD_UPDATE_POSITION, data);
    }

    private resizeEmptyElement(): void {
        if(this.emptyCardElement.classList.contains(this.dragOption.cardType))
            return;

        switch(this.dragOption.cardType) {
            case CardType.big:
                this.emptyCardElement.classList.replace('small', this.dragOption.cardType);
                break;
            case CardType.small:
                this.emptyCardElement.classList.replace('big', this.dragOption.cardType);
                break;
        }
    }

    private unsetSort(): void {
        this.sortType = SortType.NONE;
        this.emitEvent(WeatherAction.SORT_RESET);
    }

    private unsetFilterWeather(): void {
        this.filterWeather = {
            sunny: false,
            cloudy: false,
            snowy: false,
            rainy: false,
            blizzard: false,
            stormy: false,
            metorite: false
        };

        this.emitEvent(WeatherAction.FILTER_WEATHER_RESET);
    }

    private pushToStorage(toStorage: City[], prevCardName: string, cityWeather: City): void {
        if(prevCardName === undefined) {
            toStorage.unshift(cityWeather);
        } else {
            const idx = toStorage.findIndex((item: City) => item.city === prevCardName);

            if(idx+1 === toStorage.length) toStorage.push(cityWeather);
            else toStorage.splice(idx + 1, 0, cityWeather);
        }
    }

    private emitEvent(action: WeatherAction, data?: any): void {
        window.dispatchEvent(new CustomEvent(action, { detail: data }));
    }

    private createChangePositionType(): ChangePositionType {
        return (this.dragOption.dragElement.dataset.type + '=>' + this.dragOption.cardType) as ChangePositionType;
    }
}