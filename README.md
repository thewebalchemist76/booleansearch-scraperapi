# Boolean Search - Google via ScraperAPI

Ricerca booleana automatica su Google usando ScraperAPI.

## Setup Backend

1. Crea account su [ScraperAPI](https://www.scraperapi.com/)
2. Ottieni la tua API key
3. Deploy su Render.com:
   - New Web Service
   - Connect GitHub repo
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Add Environment Variable: `SCRAPERAPI_KEY` = your_api_key

## Setup Frontend

1. Deploy su Render.com:
   - New Static Site
   - Connect GitHub repo
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`
   - Add Environment Variable: `VITE_API_URL` = backend_url

## Costi

- **ScraperAPI Hobby Plan**: $49/mese per 100.000 richieste
- **Render Free**: Hosting gratuito per backend e frontend
- **Totale**: $49/mese

## Uso

1. Inserisci domini (uno per riga)
2. Inserisci titoli articoli (uno per riga)
3. Click "Avvia Ricerca"
4. Scarica CSV con i risultati

## Calcolo richieste

Richieste = Domini × Articoli
Esempio: 80 domini × 10 articoli = 800 richieste/giorno = 24.000/mese