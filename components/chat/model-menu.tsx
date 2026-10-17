"use client"

import { ChevronDownIcon } from "lucide-react"
import ProviderLabel from "@/components/chat/provider-label"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type ChatModel, type ChatModelId, describeRelativeCost, listProviderDefaults } from "@/lib/chat-models"

type ModelMenuProps = {
  models: ChatModel[]
  modelId: ChatModelId
  onModelChange: (modelId: ChatModelId) => void
}

type ProviderSubmenuProps = ModelMenuProps & Pick<ChatModel, "provider" | "logo">

const ProviderSubmenu = ({ provider, logo, models, modelId, onModelChange }: ProviderSubmenuProps) => (
  <DropdownMenuSub>
    <DropdownMenuSubTrigger>
      <ProviderLabel provider={provider} logo={logo} />
    </DropdownMenuSubTrigger>
    <DropdownMenuSubContent>
      <DropdownMenuRadioGroup value={modelId} onValueChange={onModelChange}>
        {models.map((model) => (
          <DropdownMenuRadioItem key={model.id} value={model.id} closeOnClick>
            {model.name}
            <span className="ml-auto pl-4 text-xs text-muted-foreground">{describeRelativeCost(model)}</span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuSubContent>
  </DropdownMenuSub>
)

const ModelMenu = ({ models, modelId, onModelChange }: ModelMenuProps) => {
  const providerDefaults = listProviderDefaults(models)
  const chosenModel = models.find(({ id }) => id === modelId) ?? providerDefaults[0]
  const listProviderModels = (provider: string) => models.filter((model) => model.provider === provider)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" size="sm" className="mr-auto" />}
        aria-label={`Model: ${chosenModel.provider} ${chosenModel.name}`}
      >
        <ProviderLabel provider={chosenModel.provider} logo={chosenModel.logo} />
        <ChevronDownIcon className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="w-auto">
        {providerDefaults.map(({ provider, logo }) => (
          <ProviderSubmenu
            key={provider}
            provider={provider}
            logo={logo}
            models={listProviderModels(provider)}
            modelId={modelId}
            onModelChange={onModelChange}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ModelMenu
