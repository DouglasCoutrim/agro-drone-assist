import { createContext, useContext } from "react";

/**
 * Indica que o conteúdo está dentro de um bloco do painel personalizável, que já oferece
 * encolher/expandir no cabeçalho do bloco. Serve para o cartão não mostrar um segundo botão
 * de encolher para o mesmo conteúdo.
 */
export const PainelBlocoContext = createContext(false);

export const useDentroDeBlocoPainel = () => useContext(PainelBlocoContext);
