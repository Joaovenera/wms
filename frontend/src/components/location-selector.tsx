import { useState } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const PREDEFINED_LOCATIONS = [
  "Santa Catarina",
  "São Paulo", 
  "Rio de Janeiro",
  "Minas Gerais",
  "Paraná",
  "Rio Grande do Sul",
  "Bahia",
  "Goiás",
  "Pernambuco",
  "Ceará",
  "Brasília",
  "Espírito Santo"
];

interface LocationSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  id?: string;
}

export function LocationSelector({ 
  value, 
  onChange, 
  label, 
  placeholder = "Selecione uma localização",
  id 
}: LocationSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const handleLocationSelect = (selectedValue: string) => {
    if (selectedValue === "custom") {
      setShowCustomInput(true);
      setOpen(false);
      return;
    }
    
    onChange(selectedValue);
    setOpen(false);
    setShowCustomInput(false);
  };

  const handleCustomInputSubmit = () => {
    if (customValue.trim()) {
      onChange(customValue.trim());
      setCustomValue("");
      setShowCustomInput(false);
    }
  };

  const handleCustomInputCancel = () => {
    setCustomValue("");
    setShowCustomInput(false);
  };

  const selectedLocation = PREDEFINED_LOCATIONS.find(location => location === value);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      
      {showCustomInput ? (
        <div className="space-y-2">
          <Input
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Digite a localização personalizada"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCustomInputSubmit();
              } else if (e.key === "Escape") {
                handleCustomInputCancel();
              }
            }}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCustomInputSubmit}
              disabled={!customValue.trim()}
            >
              Confirmar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCustomInputCancel}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-500" />
                {selectedLocation || value || placeholder}
              </div>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder="Buscar localização..." />
              <CommandList>
                <CommandEmpty>Nenhuma localização encontrada.</CommandEmpty>
                <CommandGroup heading="Localizações Predefinidas">
                  {PREDEFINED_LOCATIONS.map((location) => (
                    <CommandItem
                      key={location}
                      value={location}
                      onSelect={() => handleLocationSelect(location)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        {location}
                      </div>
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          value === location ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandGroup heading="Personalizado">
                  <CommandItem
                    value="custom"
                    onSelect={() => handleLocationSelect("custom")}
                    className="flex items-center gap-2"
                  >
                    <MapPin className="h-4 w-4 text-gray-500" />
                    Outra localização...
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}