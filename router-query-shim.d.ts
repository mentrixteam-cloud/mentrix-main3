declare module "@tanstack/react-query" {
  export class QueryClient {
    constructor(...args: any[]);
  }

  export const QueryClientProvider: any;
  export const useQuery: any;
  export const useMutation: any;
  export const useQueryClient: any;
}

declare module "react-router-dom" {
  export const BrowserRouter: any;
  export const Routes: any;
  export const Route: any;
  export const Navigate: any;
  export const Link: any;
  export const NavLink: any;
  export const Outlet: any;
  export const useNavigate: any;
  export const useLocation: any;
  export const useParams: any;
}
