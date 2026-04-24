# Fallback for nix-shell without flakes
(builtins.getFlake (toString ./.)).devShells.${builtins.currentSystem}.default

