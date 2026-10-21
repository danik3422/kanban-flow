import { Globe2, LockKeyhole, UsersRound } from 'lucide-react'

// Who can open a board, and the icon that stands for each choice.
export const VISIBILITIES = ['private', 'workspace', 'public']
export const VISIBILITY_ICONS = { private: LockKeyhole, workspace: UsersRound, public: Globe2 }
