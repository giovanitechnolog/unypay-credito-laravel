import { forwardRef, InputHTMLAttributes, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Input de senha com botão "olhinho" embutido para alternar entre
 * mascarado (`type="password"`) e visível (`type="text"`).
 *
 * É um drop-in replacement de `<input type="password" ... />`:
 * aceita todas as props nativas (className, style, value, onChange,
 * required, autoComplete, minLength, etc.) e o estado de visibilidade
 * é totalmente local — quem usa não precisa gerenciar nada extra.
 *
 * O botão fica posicionado absolutamente dentro do input, preservando
 * a estética e o sistema de design da página onde for usado (sigx-input
 * em Users, inputStyle inline em UserFormModal, etc.).
 */
type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ style, className, ...rest }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <div style={{ position: "relative", display: "block", width: "100%" }}>
        <input
          ref={ref}
          {...rest}
          type={visible ? "text" : "password"}
          className={[className, "password-input"].filter(Boolean).join(" ") || undefined}
          style={{
            // Reserva espaço à direita para o botão não cobrir o texto.
            paddingRight: 38,
            // Senhas nunca devem sofrer text-transform (caixa alta quebra login).
            textTransform: "none",
            ...style,
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Ocultar senha" : "Exibir senha"}
          title={visible ? "Ocultar senha" : "Exibir senha"}
          style={{
            position: "absolute",
            top: "50%",
            right: 8,
            transform: "translateY(-50%)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#6b7280",
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            lineHeight: 0,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  },
);

export default PasswordInput;
