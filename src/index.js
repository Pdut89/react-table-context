import React, { createContext, Component } from 'react'
import hash from 'hash-sum'

export default function initTableContext (getData = () => Promise.resolve([])) {
  const TableContext = createContext()

  class TableProvider extends Component {
    constructor () {
      super()
      this.state = {
        page: 0,
        pageSize: 10,
        firstPage: true,
        isLoading: false,
        isEmpty: true,
        data: [],
        meta: {},
        error: null,
        filters: {},
        unappliedFilters: {},
        sorting: {},
        pageData: [],
        selected: [],
        search: ''
      }

      this.key = hash(Date.now())
      this.cache = new Map()
    }

    static defaultProps = {
      onError: console.error,
      pageSize: 10,
      filters: {},
      getCacheKey: state => hash(state)
    };

    componentDidMount () {
      const { pageSize, filters, selected = [] } = this.props
      this.setState({ pageSize, filters, selected }, () => this.handleUpdate())
    }

    handleUpdate = () => {
      const { meta, page, pageSize, search, filters, sorting } = this.state
      const key = this.props.getCacheKey({
        meta,
        page,
        pageSize,
        search,
        filters,
        sorting,
        key: this.key
      })

      if (this.cache.has(key)) {
        const newState = this.cache.get(key)
        this.setState({ ...newState })
      } else {
        this.setState({ isLoading: true }, () => {
          getData({ ...this.state })
            .then(response => {
              let data = []
              let meta = {}

              if (response.data && response.meta) {
                data = response.data
                meta = response.meta
              } else {
                data = response
                meta = { count: data.length }
              }

              if (!Array.isArray(data)) {
                throw new Error(
                  `Invalid data provided. Expected array, but got ${typeof data}`
                )
              }

              this.setState(
                currentState => {
                  const start = currentState.page * currentState.pageSize
                  const end = start + currentState.pageSize

                  return {
                    ...currentState,
                    data,
                    meta,
                    firstPage: currentState.page === 0,
                    pageData: data.slice(start, end),
                    isEmpty: data.length === 0,
                    isLoading: false
                  }
                },
                () => {
                  const {
                    firstPage,
                    isEmpty,
                    isLoading,
                    pageData,
                    unappliedFilters,
                    meta,
                    page,
                    pageSize,
                    search,
                    filters
                  } = this.state

                  this.cache.set(key, {
                    data: this.state.data,
                    firstPage,
                    isEmpty,
                    isLoading,
                    pageData,
                    unappliedFilters,
                    meta,
                    page,
                    pageSize,
                    search,
                    filters
                  })
                }
              )
            })
            .catch(error => {
              console.error(error)
              this.props.onError(error)
              this.setState(error)
            })
        })
      }
    };

    setSearch = search => {
      this.setState({ search, page: 0 }, () => this.handleUpdate())
    };

    setPage = page => {
      this.setState({ page }, () => this.handleUpdate())
    };

    setPageSize = pageSize => {
      this.setState({ pageSize }, () => this.handleUpdate())
    };

    setSelected = selected => {
      // NOTE: We do not want to refresh table if a item becomes selected.
      this.setState({ selected })
    };

    toggleSelectAll = () => {
      const { data, selected: currentSelection } = this.state
      const selected = currentSelection.length === data.length ? [] : data
      this.setState({ selected })
    };

    setFilters = (filters, clearData = false) => {
      const { data } = this.state
      this.setState(
        {
          filters,
          unappliedFilters: filters,
          page: 0,
          data: clearData ? [] : data
        },
        () => this.handleUpdate()
      )
    };

    setUnappliedFilters = filters => {
      this.setState({
        unappliedFilters: filters
      })
    };

    applyFilters = () => {
      const { unappliedFilters } = this.state
      this.setFilters(unappliedFilters)
    };

    setSorting = sorting => {
      this.setState({ sorting }, () => this.handleUpdate())
    };

    refresh = () => {
      this.handleUpdate()
    };

    render () {
      const value = {
        ...this.state,
        setSearch: this.setSearch,
        setPage: this.setPage,
        setSorting: this.setSorting,
        setPageSize: this.setPageSize,
        refresh: this.refresh,
        setSelected: this.setSelected,
        toggleSelectAll: this.toggleSelectAll,
        setFilters: this.setFilters,
        setUnappliedFilters: this.setUnappliedFilters,
        applyFilters: this.applyFilters
      }

      return (
        <TableContext.Provider value={value}>
          {this.props.children}
        </TableContext.Provider>
      )
    }
  }

  return [TableProvider, TableContext.Consumer]
}
