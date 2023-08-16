import { subscribeKey as subKey } from 'valtio/utils'
import { proxy } from 'valtio/vanilla'
import { CoreHelperUtil } from '../utils/CoreHelperUtil.js'
import { FetchUtil } from '../utils/FetchUtil.js'
import type {
  ApiGetWalletsRequest,
  ApiGetWalletsResponse,
  ApiWallet,
  ProjectId,
  SdkVersion
} from '../utils/TypeUtils.js'
import { AssetController } from './AssetController.js'
import { NetworkController } from './NetworkController.js'

// -- Helpers ------------------------------------------- //
const api = new FetchUtil({ baseUrl: 'https://api.web3modal.com' })
const entries = 24
const recommendedEntries = 4
const sdkType = 'w3m'

// -- Types --------------------------------------------- //
export interface ApiControllerState {
  projectId: ProjectId
  sdkVersion: SdkVersion
  page: number
  count: number
  recommended: ApiWallet[]
  wallets: ApiWallet[]
  search: ApiWallet[]
}

type StateKey = keyof ApiControllerState

// -- State --------------------------------------------- //
const state = proxy<ApiControllerState>({
  projectId: '',
  sdkVersion: 'html-wagmi-undefined',
  page: 1,
  count: 0,
  recommended: [],
  wallets: [],
  search: []
})

// -- Controller ---------------------------------------- //
export const ApiController = {
  state,

  subscribeKey<K extends StateKey>(key: K, callback: (value: ApiControllerState[K]) => void) {
    return subKey(state, key, callback)
  },

  setProjectId(projectId: ApiControllerState['projectId']) {
    state.projectId = projectId
  },

  setSdkVersion(sdkVersion: ApiControllerState['sdkVersion']) {
    state.sdkVersion = sdkVersion
  },

  getApiHeaders() {
    return {
      'x-project-id': state.projectId,
      'x-sdk-type': sdkType,
      'x-sdk-version': state.sdkVersion
    }
  },

  async fetchWalletImage(imageId: string) {
    const imageUrl = `${api.baseUrl}/getWalletImage/${imageId}`
    const blob = await api.getBlob({ path: imageUrl, headers: ApiController.getApiHeaders() })
    AssetController.setWalletImage(imageId, URL.createObjectURL(blob))
  },

  async fetchNetworkImage(imageId: string) {
    const imageUrl = `${api.baseUrl}/public/getAssetImage/${imageId}`
    const blob = await api.getBlob({ path: imageUrl, headers: ApiController.getApiHeaders() })
    AssetController.setNetworkImage(imageId, URL.createObjectURL(blob))
  },

  async fetchNetworkImages() {
    const { requestedCaipNetworks } = NetworkController.state
    const imageIds = requestedCaipNetworks?.map(({ imageId }) => imageId) ?? []
    const imageIdsStrings = imageIds.filter(id => typeof id === 'string') as string[]
    await Promise.all(imageIdsStrings.map(id => ApiController.fetchNetworkImage(id)))
  },

  async fetchRecommendedWallets() {
    const { data } = await api.post<ApiGetWalletsResponse>({
      path: '/getWallets',
      headers: ApiController.getApiHeaders(),
      body: {
        page: 1,
        entries: recommendedEntries
      }
    })
    await Promise.all(data.map(({ image_id }) => ApiController.fetchWalletImage(image_id)))
    state.recommended = data
  },

  async fetchWallets({ page }: Pick<ApiGetWalletsRequest, 'page'>) {
    const exclude = state.recommended.map(({ id }) => id)
    const { data, count } = await api.post<ApiGetWalletsResponse>({
      path: '/getWallets',
      headers: ApiController.getApiHeaders(),
      body: {
        page,
        entries,
        exclude
      }
    })
    await Promise.all([
      ...data.map(({ image_id }) => ApiController.fetchWalletImage(image_id)),
      CoreHelperUtil.wait(300)
    ])
    state.wallets = [...state.wallets, ...data]
    state.count = count
    state.page = page
  },

  async searchWallet({ search }: Pick<ApiGetWalletsRequest, 'search'>) {
    state.search = []
    const { data } = await api.post<ApiGetWalletsResponse>({
      path: '/getWallets',
      headers: ApiController.getApiHeaders(),
      body: {
        page: 1,
        entries: 100,
        search
      }
    })
    await Promise.all(data.map(({ image_id }) => ApiController.fetchWalletImage(image_id)))
    state.search = data
  }
}