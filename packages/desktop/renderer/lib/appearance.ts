export const appearanceThemes=['graphite','midnight','oled','contrast'] as const
export const appearanceAccents=['green','blue','violet','amber','rose'] as const
export function normalizeAppearance(theme:unknown,accent:unknown){
    return {theme:appearanceThemes.find(value=>value===theme)??'graphite',accent:appearanceAccents.find(value=>value===accent)??'green'}
}
