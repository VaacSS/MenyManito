// Estado del juego
const gameState = {
  currentPokemon: [],
  rankings: {},
  pokemonData: {}, // Almacena datos adicionales como imagen, nombre en español, etc.
  isSelecting: false,
  importedRankings: null,
  topBest: [],
  topWorst: [],
  leftWins: 0, // Contador de victorias izquierda
  rightWins: 0, // Contador de victorias derecha
  timestamps: {}, // Para guardar cuándo se agregó cada Pokémon al ranking
  battleHistory: [], // Historial de batallas: [{winner: 'pokemon1', loser: 'pokemon2', date: timestamp}]
  gameStarted: false, // Para controlar si el juego ha comenzado
  stageData: {
    currentStage: 1,
    totalStages: 0,
    pokemonPerStage: 20, // Cantidad de pokémon por etapa
    stagePokemons: [], // Pokémon de la etapa actual
    currentBattle: 0,
    stageBattles: 0, // Total de batallas en la etapa actual
  },
  allPokemons: [], // Listado de todos los pokémon disponibles (del 1 al 898)
}

// Elementos del DOM
const pokemon1Element = document.getElementById("pokemon1")
const pokemon2Element = document.getElementById("pokemon2")
const allRankingsElement = document.getElementById("all-rankings")
const topBestElement = document.getElementById("top-best")
const topWorstElement = document.getElementById("top-worst")
const leftCounterElement = document.getElementById("left-counter")
const rightCounterElement = document.getElementById("right-counter")
const exportBtn = document.getElementById("export-btn")
const importBtn = document.getElementById("import-btn")
const fileInput = document.getElementById("file-input")
const notification = document.getElementById("notification")
const importModal = document.getElementById("import-modal")
const replaceBtn = document.getElementById("replace-btn")
const mergeBtn = document.getElementById("merge-btn")
const cancelImportBtn = document.getElementById("cancel-import-btn")
const hamburgerIcon = document.querySelector(".hamburger-icon")
const sidebar = document.querySelector(".sidebar")
const overlay = document.querySelector(".overlay")
const pokemonPreview = document.getElementById("pokemon-preview")
const previewImg = document.getElementById("preview-img")
const previewName = document.getElementById("preview-name")
const previewPoints = document.getElementById("preview-points")
const previewRank = document.getElementById("preview-rank")
const previewBattles = document.getElementById("preview-battles")
const previewClose = document.querySelector(".preview-close")
const startGameBtn = document.getElementById("start-game-btn")
const battleContainer = document.getElementById("battle-container")
const rankingsContainer = document.getElementById("rankings-container")
const resetStageBtn = document.getElementById("reset-stage-btn")
const currentStageElement = document.getElementById("current-stage")
const totalStagesElement = document.getElementById("total-stages")
const stageProgressElement = document.getElementById("stage-progress")

// Constantes
const POKEMON_MAX_ID = 1025 // Número total de Pokémon disponibles (actualizado a Gen 9)
const BATCH_SIZE = 50 // Número de Pokémon a cargar en cada lote
const INITIAL_POINTS = 1000 // Puntos iniciales para cada Pokémon

// Inicializar el juego
async function initGame() {
  // Inicializar lista de todos los pokémon
  gameState.allPokemons = Array.from({ length: POKEMON_MAX_ID }, (_, i) => i + 1)

  // Añadir event listeners
  startGameBtn.addEventListener("click", startGame)
  exportBtn.addEventListener("click", exportRankings)
  importBtn.addEventListener("click", () => fileInput.click())
  fileInput.addEventListener("change", handleFileSelect)
  replaceBtn.addEventListener("click", () => importRankings(true))
  mergeBtn.addEventListener("click", () => importRankings(false))
  cancelImportBtn.addEventListener("click", () => {
    importModal.style.display = "none"
    gameState.importedRankings = null
  })
  resetStageBtn.addEventListener("click", resetCurrentStage)

  // Event listeners para el menú hamburguesa
  hamburgerIcon.addEventListener("click", toggleSidebar)
  overlay.addEventListener("click", closeSidebar)

  // Event listener para cerrar la vista previa del Pokémon
  document.querySelector(".preview-close").addEventListener("click", (e) => {
    e.stopPropagation() // Prevenir que el click se propague
    closePokemonPreview()
  })

  // Asegurar que el evento de click en el fondo también cierre la vista previa
  pokemonPreview.addEventListener("click", (e) => {
    if (e.target === pokemonPreview) {
      closePokemonPreview()
    }
  })

  // Precargar datos de Pokémon (se pueden cargar de manera progresiva)
  await precachePokemonData()

  // Calcular número total de etapas
  calculateStages()

  // Mostrar número total de etapas
  totalStagesElement.textContent = gameState.stageData.totalStages
}

// Precargar datos básicos de Pokémon
async function precachePokemonData() {
  showNotification("Cargando datos de Pokémon...")

  // Inicializa los rankings con todos los Pokémon
  for (let i = 1; i <= POKEMON_MAX_ID; i++) {
    if (!gameState.rankings[`pokemon-${i}`]) {
      gameState.rankings[`pokemon-${i}`] = INITIAL_POINTS
      gameState.timestamps[`pokemon-${i}`] = Date.now()
    }
  }

  // Cargar datos de todos los Pokémon en lotes para evitar sobrecargar la API
  try {
    // Primero obtenemos la lista de especies para tener los nombres en español
    const speciesResponse = await fetch("https://pokeapi.co/api/v2/pokemon-species?limit=1025")
    const speciesData = await speciesResponse.json()
    const speciesList = speciesData.results

    // Procesar en lotes
    for (let i = 0; i < POKEMON_MAX_ID; i += BATCH_SIZE) {
      const batchPromises = []
      const end = Math.min(i + BATCH_SIZE, POKEMON_MAX_ID)

      // Crear promesas para cada Pokémon en el lote
      for (let j = i; j < end; j++) {
        const pokemonId = j + 1
        batchPromises.push(fetchPokemonBasicData(pokemonId, speciesList[j]?.url))
      }

      // Esperar a que se completen todas las promesas del lote
      const batchResults = await Promise.all(batchPromises)

      // Procesar resultados
      batchResults.forEach((pokemon) => {
        if (pokemon) {
          const key = `pokemon-${pokemon.id}`
          gameState.pokemonData[key] = {
            spanishName: pokemon.spanishName,
            englishName: pokemon.englishName,
            image: pokemon.image,
            battles: gameState.pokemonData[key]?.battles || 0,
          }
        }
      })

      // Actualizar progreso
      const progress = Math.min(100, Math.round((end / POKEMON_MAX_ID) * 100))
      showNotification(`Cargando Pokémon... ${progress}%`)
    }

    // Actualizar la UI con los rankings iniciales
    updateRankingsDisplay()
    showNotification("¡Datos de Pokémon cargados correctamente!")
  } catch (error) {
    console.error("Error cargando datos de Pokémon:", error)
    showNotification("Error cargando datos. Algunos Pokémon pueden no estar disponibles.")
  }
}

// Función para obtener datos básicos de un Pokémon (solo nombre e imagen)
async function fetchPokemonBasicData(id, speciesUrl) {
  try {
    // Obtener datos básicos del Pokémon
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
    const data = await response.json()

    // Obtener nombre en español si está disponible
    let spanishName = data.name
    if (speciesUrl) {
      try {
        const speciesResponse = await fetch(speciesUrl)
        const speciesData = await speciesResponse.json()
        const spanishNameData = speciesData.names.find((name) => name.language.name === "es")
        if (spanishNameData) {
          spanishName = spanishNameData.name
        }
      } catch (error) {
        console.error(`Error obteniendo nombre en español para Pokémon #${id}:`, error)
      }
    }

    return {
      id: data.id,
      englishName: data.name,
      spanishName: spanishName,
      image: data.sprites.other["official-artwork"].front_default || data.sprites.front_default,
    }
  } catch (error) {
    console.error(`Error obteniendo datos básicos para Pokémon #${id}:`, error)
    return null
  }
}

// Calcular el número total de etapas
function calculateStages() {
  // Cada etapa tiene gameState.stageData.pokemonPerStage Pokémon
  // Esto permite que cada Pokémon participe en al menos una batalla
  gameState.stageData.totalStages = Math.ceil(POKEMON_MAX_ID / gameState.stageData.pokemonPerStage)

  // Preparar la primera etapa
  prepareStage(1)
}

// Preparar una etapa específica
function prepareStage(stageNumber) {
  // Actualizar etapa actual
  gameState.stageData.currentStage = stageNumber
  currentStageElement.textContent = stageNumber

  // Calcular qué Pokémon corresponden a esta etapa
  const startIndex = (stageNumber - 1) * gameState.stageData.pokemonPerStage
  const endIndex = Math.min(startIndex + gameState.stageData.pokemonPerStage, POKEMON_MAX_ID)

  // Obtener los IDs de Pokémon para esta etapa
  gameState.stageData.stagePokemons = gameState.allPokemons.slice(startIndex, endIndex)

  // Barajar aleatoriamente los Pokémon de la etapa
  gameState.stageData.stagePokemons = shuffleArray(gameState.stageData.stagePokemons)

  // Calculamos el número de batallas para esta etapa
  // En cada batalla participan 2 Pokémon, así que dividimos entre 2
  // Si hay un número impar, el último Pokémon se queda sin batallar
  gameState.stageData.stageBattles = Math.floor(gameState.stageData.stagePokemons.length / 2)

  // Reiniciar contador de batalla actual
  gameState.stageData.currentBattle = 0

  // Actualizar barra de progreso
  updateStageProgress()
}

// Actualizar la barra de progreso de la etapa
function updateStageProgress() {
  const percentage =
    gameState.stageData.stageBattles > 0
      ? (gameState.stageData.currentBattle / gameState.stageData.stageBattles) * 100
      : 0

  stageProgressElement.style.width = `${percentage}%`
}

// Reiniciar la etapa actual
function resetCurrentStage() {
  prepareStage(gameState.stageData.currentStage)
  loadNewPokemonPair()
  showNotification("Etapa reiniciada")
  closeSidebar()
}

// Avanzar a la siguiente etapa
function advanceToNextStage() {
  if (gameState.stageData.currentStage < gameState.stageData.totalStages) {
    prepareStage(gameState.stageData.currentStage + 1)
    showNotification(`¡Avanzando a la Etapa ${gameState.stageData.currentStage}!`)
  } else {
    // Si estamos en la última etapa, volvemos a la primera
    prepareStage(1)
    showNotification("¡Todas las etapas completadas! Comenzando de nuevo desde la Etapa 1")
  }

  // Cargar nueva pareja de Pokémon
  loadNewPokemonPair()
}

// Barajar array usando el algoritmo Fisher-Yates
function shuffleArray(array) {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

// Iniciar el juego
function startGame() {
  if (gameState.gameStarted) return

  gameState.gameStarted = true
  startGameBtn.style.display = "none"
  battleContainer.style.display = "flex"
  rankingsContainer.style.display = "block"

  // Cargar Pokémon iniciales
  loadNewPokemonPair()

  // Actualizar contadores
  updateCounters()

  // Añadir event listeners para las cartas
  pokemon1Element.addEventListener("click", () => selectPokemon(0, 1))
  pokemon2Element.addEventListener("click", () => selectPokemon(1, 0))
}

// Abrir/cerrar el menú lateral
function toggleSidebar() {
  hamburgerIcon.classList.toggle("active")
  sidebar.classList.toggle("active")
  overlay.classList.toggle("active")
}

// Cerrar el menú lateral
function closeSidebar() {
  hamburgerIcon.classList.remove("active")
  sidebar.classList.remove("active")
  overlay.classList.remove("active")
}

// Mostrar la vista previa de un Pokémon
async function showPokemonPreview(pokemon) {
  previewImg.src = pokemon.image
  previewName.textContent = pokemon.name
  previewPoints.textContent = `Puntos: ${pokemon.points}`

  // Buscar el ranking del Pokémon
  const rankingsArray = Object.entries(gameState.rankings).map(([name, points]) => ({ name, points }))
  const sortedRankings = [...rankingsArray].sort((a, b) => b.points - a.points)
  const rank = sortedRankings.findIndex((p) => p.name === pokemon.englishName) + 1

  previewRank.textContent = `Ranking: #${rank}`

  // Mostrar número de batallas si está disponible
  const battles = pokemon.battles || 0
  previewBattles.textContent = `Batallas: ${battles}`

  // Mostrar la vista previa inmediatamente
  pokemonPreview.classList.add("active")
}

// Cerrar la vista previa del Pokémon
function closePokemonPreview() {
  pokemonPreview.classList.remove("active")
}

// Actualizar contadores de victorias
function updateCounters() {
  leftCounterElement.textContent = gameState.leftWins
  rightCounterElement.textContent = gameState.rightWins
}

// Obtener Pokémon específico por ID
async function fetchPokemonById(id) {
  // Verificar si ya tenemos los datos del Pokémon
  const pokemonKey = `pokemon-${id}`
  const existingData = gameState.pokemonData[pokemonKey]

  if (existingData && existingData.spanishName && existingData.image) {
    // Si ya tenemos los datos, crear el objeto Pokémon directamente
    return {
      id: id,
      name: existingData.spanishName,
      englishName: existingData.englishName || `pokemon-${id}`,
      image: existingData.image,
      points: gameState.rankings[pokemonKey] || INITIAL_POINTS,
      battles: existingData.battles || 0,
      timestamp: gameState.timestamps[pokemonKey] || Date.now(),
    }
  }

  // Si no tenemos los datos, obtenerlos de la API
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
    const data = await response.json()

    // Obtener el nombre en español
    let spanishName = data.name
    try {
      const speciesResponse = await fetch(data.species.url)
      const speciesData = await speciesResponse.json()
      const spanishNameData = speciesData.names.find((name) => name.language.name === "es")
      if (spanishNameData) {
        spanishName = spanishNameData.name
      }
    } catch (error) {
      console.error("Error obteniendo el nombre en español:", error)
    }

    // Crear objeto Pokémon
    const pokemon = {
      id: data.id,
      name: spanishName,
      englishName: data.name,
      image: data.sprites.other["official-artwork"].front_default || data.sprites.front_default,
      points: gameState.rankings[pokemonKey] || INITIAL_POINTS,
      battles: gameState.pokemonData[pokemonKey]?.battles || 0,
      timestamp: gameState.timestamps[pokemonKey] || Date.now(),
    }

    // Guardar datos del Pokémon para uso futuro
    gameState.pokemonData[pokemonKey] = {
      spanishName: spanishName,
      englishName: data.name,
      image: pokemon.image,
      battles: gameState.pokemonData[pokemonKey]?.battles || 0,
    }

    return pokemon
  } catch (error) {
    console.error("Error obteniendo Pokémon:", error)
    return null
  }
}

// Cargar un nuevo par de Pokémon
async function loadNewPokemonPair() {
  // Verificar si hemos completado todas las batallas de la etapa
  if (gameState.stageData.currentBattle >= gameState.stageData.stageBattles) {
    advanceToNextStage()
    return
  }

  // Resetear estilos de tarjetas
  pokemon1Element.classList.remove("winner")
  pokemon2Element.classList.remove("winner")

  // Mostrar spinners de carga
  pokemon1Element.querySelector(".pokemon-image-container").innerHTML = '<div class="loading-spinner"></div>'
  pokemon2Element.querySelector(".pokemon-image-container").innerHTML = '<div class="loading-spinner"></div>'

  pokemon1Element.querySelector(".pokemon-name").textContent = "Cargando..."
  pokemon2Element.querySelector(".pokemon-name").textContent = "Cargando..."

  // Obtener los próximos dos Pokémon de la etapa actual
  const battleIndex = gameState.stageData.currentBattle * 2
  const pokemon1Id = gameState.stageData.stagePokemons[battleIndex]
  const pokemon2Id = gameState.stageData.stagePokemons[battleIndex + 1]

  // Obtener datos completos de los Pokémon
  const pokemon1 = await fetchPokemonById(pokemon1Id)
  const pokemon2 = await fetchPokemonById(pokemon2Id)

  // Almacenar Pokémon actuales
  gameState.currentPokemon = [pokemon1, pokemon2]

  // Actualizar la UI
  updatePokemonCard(pokemon1Element, pokemon1)
  updatePokemonCard(pokemon2Element, pokemon2)

  // Actualizar rankings
  updateRankingsDisplay()

  // Incrementar contador de batallas de la etapa
  gameState.stageData.currentBattle++

  // Actualizar barra de progreso
  updateStageProgress()
}

// Actualizar una tarjeta de Pokémon con datos
function updatePokemonCard(cardElement, pokemon) {
  const imageContainer = cardElement.querySelector(".pokemon-image-container")
  const nameElement = cardElement.querySelector(".pokemon-name")
  const pointsElement = cardElement.querySelector(".pokemon-points")

  // Actualizar imagen
  imageContainer.innerHTML = `<img src="${pokemon.image}" alt="${pokemon.name}" class="pokemon-image">`

  // Actualizar nombre y puntos
  nameElement.textContent = pokemon.name
  pointsElement.textContent = `${pokemon.points} pts`

  // Actualizar color de puntos
  updatePointsColor(pointsElement, pokemon.points)
}

// Actualizar el color de los puntos basado en el valor
function updatePointsColor(element, points) {
  // Escala de color basada en puntos
  if (points >= 1500) {
    element.style.backgroundColor = "var(--high-score)"
  } else if (points >= 800) {
    element.style.backgroundColor = "var(--mid-score)"
  } else {
    element.style.backgroundColor = "var(--low-score)"
  }
}

// Manejar selección de Pokémon
function selectPokemon(winnerIndex, loserIndex) {
  // Prevenir múltiples selecciones mientras se anima
  if (gameState.isSelecting) return
  gameState.isSelecting = true

  const winner = gameState.currentPokemon[winnerIndex]
  const loser = gameState.currentPokemon[loserIndex]

  // Incrementar contadores de victorias
  if (winnerIndex === 0) {
    gameState.leftWins++
  } else {
    gameState.rightWins++
  }

  // Actualizar contadores en la UI
  updateCounters()

  // Incrementar contador de batallas
  const winnerKey = `pokemon-${winner.id}`
  const loserKey = `pokemon-${loser.id}`

  if (gameState.pokemonData[winnerKey]) {
    gameState.pokemonData[winnerKey].battles = (gameState.pokemonData[winnerKey].battles || 0) + 1
  }
  if (gameState.pokemonData[loserKey]) {
    gameState.pokemonData[loserKey].battles = (gameState.pokemonData[loserKey].battles || 0) + 1
  }

  // Registrar la batalla en el historial
  gameState.battleHistory.push({
    winner: winnerKey,
    loser: loserKey,
    winnerPoints: winner.points,
    loserPoints: loser.points,
    date: Date.now(),
  })

  // Calcular puntos a transferir (máximo 50)
  const pointDifference = winner.points - loser.points
  let pointsToTransfer

  if (pointDifference > 0) {
    // Ganador tiene más puntos:
    // - Ganador gana menos puntos
    // - Perdedor pierde más puntos
    pointsToTransfer = Math.max(5, Math.floor(25 * (loser.points / winner.points)))
  } else {
    // Ganador tiene menos o igual puntos:
    // - Ganador gana más puntos
    // - Perdedor pierde menos puntos
    pointsToTransfer = Math.min(50, Math.floor(25 * (winner.points / loser.points) + 25))
  }

  // Actualizar puntos
  gameState.rankings[winnerKey] += pointsToTransfer
  gameState.rankings[loserKey] -= pointsToTransfer

  // Actualizar puntos de Pokémon actuales
  winner.points = gameState.rankings[winnerKey]
  loser.points = gameState.rankings[loserKey]

  // Actualizar UI
  const winnerElement = winnerIndex === 0 ? pokemon1Element : pokemon2Element
  const loserElement = loserIndex === 0 ? pokemon1Element : pokemon2Element

  // Actualizar visualización de puntos
  winnerElement.querySelector(".pokemon-points").textContent = `${winner.points} pts`
  loserElement.querySelector(".pokemon-points").textContent = `${loser.points} pts`

  // Actualizar colores de puntos
  updatePointsColor(winnerElement.querySelector(".pokemon-points"), winner.points)
  updatePointsColor(loserElement.querySelector(".pokemon-points"), loser.points)

  // Mostrar animación de ganador
  winnerElement.classList.add("winner")

  // Actualizar visualización de rankings
  updateRankingsDisplay()

  // Verificar si hay cambios en el top 5
  checkTopRankings()

  // Cargar nuevos Pokémon después de un retraso
  setTimeout(async () => {
    await loadNewPokemonPair()
    gameState.isSelecting = false
  }, 2000)
}

// Verificar si hay cambios en el top 5
function checkTopRankings() {
  // Esta función ahora solo calcula los tops una vez y los actualiza en la UI
  // Evitamos recalcular los tops cada vez que cambia un Pokémon
  updateTopRankings()
}

// Actualizar visualización de top rankings
function updateTopRankings() {
  // Convertir rankings a array para ordenar
  const rankingsArray = Object.entries(gameState.rankings).map(([name, points]) => ({
    name,
    points,
    timestamp: gameState.timestamps[name] || Date.now(), // Si no hay timestamp, usar fecha actual
  }))

  // Ordenar por puntos (descendente) y en caso de empate por timestamp (ascendente)
  const topBest = [...rankingsArray]
    .sort((a, b) => {
      if (b.points === a.points) {
        return a.timestamp - b.timestamp // Los más antiguos tienen prioridad
      }
      return b.points - a.points
    })
    .slice(0, 5)

  const topWorst = [...rankingsArray]
    .sort((a, b) => {
      if (a.points === b.points) {
        return a.timestamp - b.timestamp // Los más antiguos tienen prioridad
      }
      return a.points - b.points
    })
    .slice(0, 5)

  // Actualizar la visualización
  updateTopRankingsUI(topBestElement, topBest)
  updateTopRankingsUI(topWorstElement, topWorst)
}

// Actualizar UI de los top rankings
function updateTopRankingsUI(element, rankings) {
  element.innerHTML = ""

  rankings.forEach(async (pokemon) => {
    // Obtener datos adicionales del Pokémon
    const pokemonData = gameState.pokemonData[pokemon.name] || {}
    let image = pokemonData.image
    const name = pokemonData.spanishName || pokemon.name

    // Si no tenemos la imagen, intentar obtenerla
    if (!image) {
      const pokemonId = pokemon.name.replace("pokemon-", "")
      try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`)
        const data = await response.json()
        image = data.sprites.other["official-artwork"].front_default || data.sprites.front_default

        // Guardar la imagen para uso futuro
        if (!gameState.pokemonData[pokemon.name]) {
          gameState.pokemonData[pokemon.name] = {
            spanishName: name,
            englishName: data.name,
            image: image,
            battles: 0,
          }
        } else {
          gameState.pokemonData[pokemon.name].image = image
        }
      } catch (error) {
        console.error("Error obteniendo imagen:", error)
        image = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"
      }
    }

    const card = document.createElement("div")
    card.className = "top-pokemon-card"
    card.innerHTML = `
            <img src="${image}" alt="${name}" class="top-pokemon-img">
            <div class="top-pokemon-name">${name}</div>
            <div class="top-pokemon-points" style="background-color: ${getPointsColor(pokemon.points)}">${pokemon.points} pts</div>
        `

    // Añadir event listener para mostrar la vista previa
    card.addEventListener("click", () => {
      const fullPokemon = {
        name: name,
        englishName: pokemon.name,
        image: image,
        points: pokemon.points,
        battles: pokemonData.battles || 0,
      }
      showPokemonPreview(fullPokemon)
    })

    element.appendChild(card)
  })
}

// Actualizar la visualización de rankings
function updateRankingsDisplay() {
  // Convertir rankings a array para ordenar
  const rankingsArray = Object.entries(gameState.rankings).map(([name, points]) => {
    const pokemonId = name.replace("pokemon-", "")
    const pokemonData = gameState.pokemonData[name]
    return {
      id: pokemonId,
      name,
      points,
      spanishName: pokemonData?.spanishName || `Pokémon #${pokemonId}`,
    }
  })

  // Ordenar por puntos (descendente)
  const sortedRankings = [...rankingsArray].sort((a, b) => b.points - a.points)

  // Actualizar todos los rankings
  allRankingsElement.innerHTML = sortedRankings
    .map((pokemon, index) => {
      return `
            <li class="ranking-item">
                <span class="ranking-name">${index + 1}. ${pokemon.spanishName}</span>
                <span class="ranking-points" style="background-color: ${getPointsColor(pokemon.points)}">
                    ${pokemon.points} pts
                </span>
            </li>
        `
    })
    .join("")

  // Actualizar los tops solo si es necesario
  updateTopRankings()
}

// Obtener color para puntos
function getPointsColor(points) {
  if (points >= 1500) return "var(--high-score)"
  if (points >= 800) return "var(--mid-score)"
  return "var(--low-score)"
}

// Exportar rankings a un archivo JSON
function exportRankings() {
  // Crear objeto con los datos a exportar
  const exportData = {
    rankings: gameState.rankings,
    pokemonData: gameState.pokemonData,
    timestamps: gameState.timestamps,
    leftWins: gameState.leftWins,
    rightWins: gameState.rightWins,
    battleHistory: gameState.battleHistory,
    stageData: {
      currentStage: gameState.stageData.currentStage,
      currentBattle: gameState.stageData.currentBattle,
    },
    exportDate: new Date().toISOString(),
    version: "2.0",
  }

  // Convertir a JSON
  const jsonData = JSON.stringify(exportData, null, 2)

  // Crear blob y URL
  const blob = new Blob([jsonData], { type: "application/json" })
  const url = URL.createObjectURL(blob)

  // Crear elemento de enlace para descargar
  const a = document.createElement("a")
  a.href = url
  a.download = `pokemon-rankings-${new Date().toLocaleDateString().replace(/\//g, "-")}.json`
  document.body.appendChild(a)
  a.click()

  // Limpiar
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 0)

  // Mostrar notificación
  showNotification("Rankings exportados correctamente")

  // Cerrar sidebar
  closeSidebar()
}

// Manejar selección de archivo
function handleFileSelect(event) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const importedData = JSON.parse(e.target.result)

      // Validar que el archivo tiene el formato correcto
      if (!importedData.rankings) {
        throw new Error("Formato de archivo inválido")
      }

      // Guardar los datos importados temporalmente
      gameState.importedRankings = importedData

      // Mostrar modal para preguntar si reemplazar o combinar
      importModal.style.display = "flex"
    } catch (error) {
      showNotification("Error al importar: Archivo inválido")
      console.error("Error al importar:", error)
    }
  }
  reader.readAsText(file)

  // Resetear el input para permitir seleccionar el mismo archivo nuevamente
  event.target.value = ""

  // Cerrar sidebar
  closeSidebar()
}

// Importar rankings
function importRankings(replace) {
  if (!gameState.importedRankings) return

  if (replace) {
    // Reemplazar completamente los datos actuales
    gameState.rankings = gameState.importedRankings.rankings
    gameState.pokemonData = gameState.importedRankings.pokemonData || {}
    gameState.timestamps = gameState.importedRankings.timestamps || {}
    gameState.leftWins = gameState.importedRankings.leftWins || 0
    gameState.rightWins = gameState.importedRankings.rightWins || 0
    gameState.battleHistory = gameState.importedRankings.battleHistory || []

    // Restaurar datos de etapa si existen
    if (gameState.importedRankings.stageData) {
      gameState.stageData.currentStage = gameState.importedRankings.stageData.currentStage || 1
      gameState.stageData.currentBattle = gameState.importedRankings.stageData.currentBattle || 0
      prepareStage(gameState.stageData.currentStage)
    }
  } else {
    // Combinar rankings, reproduciendo las batallas históricas
    combineRankings()
  }

  // Actualizar contadores
  updateCounters()

  // Actualizar la visualización
  updateRankingsDisplay()

  // Actualizar los Pokémon actuales si es necesario
  if (gameState.currentPokemon.length === 2) {
    const pokemon1Key = `pokemon-${gameState.currentPokemon[0].id}`
    const pokemon2Key = `pokemon-${gameState.currentPokemon[1].id}`

    gameState.currentPokemon[0].points = gameState.rankings[pokemon1Key] || INITIAL_POINTS
    gameState.currentPokemon[1].points = gameState.rankings[pokemon2Key] || INITIAL_POINTS

    updatePokemonCard(pokemon1Element, gameState.currentPokemon[0])
    updatePokemonCard(pokemon2Element, gameState.currentPokemon[1])
  }

  // Cerrar el modal
  importModal.style.display = "none"

  // Limpiar los datos importados
  gameState.importedRankings = null

  // Mostrar notificación
  showNotification(replace ? "Rankings reemplazados correctamente" : "Rankings combinados correctamente")
}

// Combinar rankings simulando las batallas históricas
function combineRankings() {
  // Crear copia temporal de los rankings actuales
  const currentRankings = { ...gameState.rankings }
  const currentPokemonData = { ...gameState.pokemonData }

  // Fusionar información básica y sumar batallas
  for (const [key, data] of Object.entries(gameState.importedRankings.pokemonData || {})) {
    if (!currentPokemonData[key]) {
      currentPokemonData[key] = data
    } else {
      // Actualizar datos que podrían faltar
      if (!currentPokemonData[key].image && data.image) {
        currentPokemonData[key].image = data.image
      }
      if (!currentPokemonData[key].spanishName && data.spanishName) {
        currentPokemonData[key].spanishName = data.spanishName
      }
      if (!currentPokemonData[key].englishName && data.englishName) {
        currentPokemonData[key].englishName = data.englishName
      }

      // Sumar el número de batallas (importante)
      currentPokemonData[key].battles = (currentPokemonData[key].battles || 0) + (data.battles || 0)
    }
  }

  // Asegurarse de que todos los Pokémon tengan puntos iniciales
  for (const key in gameState.importedRankings.rankings) {
    if (!currentRankings[key]) {
      currentRankings[key] = INITIAL_POINTS
    }
  }

  // Recrear las batallas del archivo importado
  if (gameState.importedRankings.battleHistory && gameState.importedRankings.battleHistory.length > 0) {
    // Ordenar batallas por fecha
    const sortedBattles = [...gameState.importedRankings.battleHistory].sort((a, b) => a.date - b.date)

    // Recrear cada batalla
    for (const battle of sortedBattles) {
      // Verificar si tenemos ambos Pokémon en nuestros rankings
      if (currentRankings[battle.winner] !== undefined && currentRankings[battle.loser] !== undefined) {
        // Simular la batalla con los puntajes actuales
        simulateBattle(currentRankings, battle.winner, battle.loser)

        // No incrementamos los contadores de batallas aquí porque ya los sumamos arriba

        // Añadir al historial de batallas
        gameState.battleHistory.push({
          ...battle,
          replayedFromImport: true,
        })
      }
    }
  }

  // Actualizar los rankings con los resultados simulados
  gameState.rankings = currentRankings
  gameState.pokemonData = currentPokemonData

  // Combinar contadores de victorias
  gameState.leftWins += gameState.importedRankings.leftWins || 0
  gameState.rightWins += gameState.importedRankings.rightWins || 0

  // Combinar timestamps (mantener el más antiguo)
  for (const [name, timestamp] of Object.entries(gameState.importedRankings.timestamps || {})) {
    if (!gameState.timestamps[name] || gameState.timestamps[name] > timestamp) {
      gameState.timestamps[name] = timestamp
    }
  }

  // Combinar historial de batallas
  if (gameState.importedRankings.battleHistory) {
    // Filtrar batallas que ya existen para evitar duplicados
    const existingBattleDates = new Set(gameState.battleHistory.map((b) => b.date))
    const newBattles = gameState.importedRankings.battleHistory.filter((b) => !existingBattleDates.has(b.date))

    // Añadir nuevas batallas al historial
    gameState.battleHistory = [...gameState.battleHistory, ...newBattles]
  }
}

// Simular una batalla entre dos Pokémon
function simulateBattle(rankings, winnerKey, loserKey) {
  const winnerPoints = rankings[winnerKey]
  const loserPoints = rankings[loserKey]

  // Calcular puntos a transferir (mismo algoritmo que en selectPokemon)
  const pointDifference = winnerPoints - loserPoints
  let pointsToTransfer

  if (pointDifference > 0) {
    pointsToTransfer = Math.max(5, Math.floor(25 * (loserPoints / winnerPoints)))
  } else {
    pointsToTransfer = Math.min(50, Math.floor(25 * (winnerPoints / loserPoints) + 25))
  }

  // Actualizar puntos
  rankings[winnerKey] += pointsToTransfer
  rankings[loserKey] -= pointsToTransfer
}

// Mostrar notificación
function showNotification(message) {
  notification.textContent = message
  notification.classList.add("show")

  setTimeout(() => {
    notification.classList.remove("show")
  }, 3000)
}

// Iniciar el juego cuando la página carga
window.addEventListener("DOMContentLoaded", initGame)

