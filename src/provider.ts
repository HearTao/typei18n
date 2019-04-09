export class i18nProvider<K extends keyof any, U> {
  constructor(private maps: Record<K, U>, public lang: K) {}
  public get t() {
    return this.maps[this.lang]
  }
}
