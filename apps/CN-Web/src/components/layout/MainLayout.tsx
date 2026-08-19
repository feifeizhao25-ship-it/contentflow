    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <div className="hidden lg:block">
        <Sidebar collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed} />
      </div>

      <div
        className={cn(
          'min-h-screen flex flex-col transition-all duration-300',
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        )}
      >
        <Topbar />

        <main id="main-content" className="flex-1 w-full overflow-x-hidden px-3 py-4 sm:p-6">
