<div align="center">
  <br />
  <br />

  # TypeI18n
  
  yet another i18n solution by codegen
  
</div>


<br />

## Installtion

```sh
# npm
npm i typeI18n
# or yarn
yarn add typeI18n
```

<br />

## Cli usage

```sh
typeI18n <directory> [options]
```

example:

```sh
typeI18n locales -o locales.ts
```

### cli options

| option | description | type | default |
|---|---|---|---|
| --target, -t | generate targets | Enum { `resource`, `provider` } | `provider` |
| --output, -o | output to filepath | String | `undefined` |
| --watch, -w | watch input files change | Boolean | `false` |
| --color | colorful print if no output provide | Boolean | `true` |
| --version, -v | show ts-creator versions | Boolean | `false` |
| --help, -h | show helper | Boolean | `false` |